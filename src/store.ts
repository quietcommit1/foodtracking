import { createClient } from '@supabase/supabase-js';
import { openDB } from 'idb';
import { useEffect, useState } from 'react';
import { emptyData, tables, type Data, type Operation, type Table } from './types';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;
const database = openDB('everyday-private-v1', 1, {
  upgrade(db) {
    db.createObjectStore('accounts');
  },
});
type Cache = { data: Data; queue: Operation[] };
let owner: string | null = null;
let data = emptyData();
let queue: Operation[] = [];
let syncing = false;
let loading = false;
let error = '';
let hydrated = false;
let generation = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
let storageChain = Promise.resolve();
function persist() {
  const uid = owner;
  const value = structuredClone({ data, queue });
  if (!uid) return Promise.resolve();
  storageChain = storageChain
    .catch(() => {})
    .then(async () => {
      await (await database).put('accounts', value, uid);
    });
  return storageChain;
}
export function applyLocal(d: Data, ops: Operation[]): Data {
  const next = structuredClone(d);
  for (const op of ops) {
    let rows = next[op.table] as any[];
    rows = rows.filter((r) => r.id !== op.row.id);
    if (op.action === 'upsert') rows.push(op.row);
    (next as any)[op.table] = rows;
    if (op.action === 'delete' && op.table === 'foods') {
      next.food_portions = next.food_portions.filter((p) => p.food_id !== op.row.id);
      next.favourites = next.favourites.filter((f) => f.food_id !== op.row.id);
    }
  }
  return next;
}
export function useStore() {
  const [, tick] = useState(0);
  useEffect(() => {
    const cb = () => tick((n) => n + 1);
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);
  return { data, queue, error, loading, syncing, hydrated, owner, mutate, refresh, sync };
}
export async function setAccount(uid: string | null) {
  generation++;
  owner = uid;
  data = emptyData();
  queue = [];
  error = '';
  hydrated = false;
  loading = !!uid;
  emit();
  if (uid) {
    const g = generation;
    try {
      const cache = (await (await database).get('accounts', uid)) as Cache | undefined;
      if (g !== generation) return;
      if (cache) {
        data = cache.data;
        queue = cache.queue;
        hydrated = true;
      }
    } catch {
      if (g !== generation) return;
      error =
        'Local cache unavailable. Keep the page open and connect online; offline data cannot be retained in this browser.';
    }
    loading = false;
    emit();
    await sync();
  }
}
export async function mutate(ops: Operation[]) {
  if (!owner) throw Error('Sign in before saving');
  if (loading) throw Error('Wait for your account cache to load');
  if (ops.some((op) => op.row.user_id !== owner))
    throw Error('Account changed. Reopen the form before saving');
  data = applyLocal(data, ops);
  queue.push(...ops);
  error = '';
  emit();
  try {
    await persist();
  } catch {
    error = 'Local storage failed. Keep this page open and retry sync.';
    emit();
  }
  void sync();
}
export function op(table: Table, row: any, action: 'upsert' | 'delete' = 'upsert'): Operation {
  return { id: crypto.randomUUID(), table, row, action };
}
export function base() {
  return { id: crypto.randomUUID(), user_id: owner! };
}
export async function fetchAll(): Promise<Data> {
  if (!supabase || !owner) throw Error('Supabase is not connected');
  const uid = owner;
  const next = emptyData();
  for (const t of tables) {
    let start = 0;
    for (;;) {
      const { data: rows, error } = await supabase
        .from(t)
        .select('*')
        .eq('user_id', uid)
        .order('id')
        .range(start, start + 499);
      if (error) throw error;
      (next[t] as any[]).push(...rows);
      if (rows.length < 500) break;
      start += 500;
    }
  }
  return next;
}
export async function refresh() {
  return sync();
}
export async function sync() {
  if (syncing || !owner || !supabase) return;
  if (!navigator.onLine) {
    emit();
    return;
  }
  const g = generation;
  syncing = true;
  error = '';
  emit();
  try {
    while (queue.length) {
      if (g !== generation) return;
      const batch = queue.slice(0, 100);
      const { error: e } = await supabase.rpc('apply_operations', { ops: batch });
      if (g !== generation) return;
      if (e) throw e;
      const sent = new Set(batch.map((o) => o.id));
      queue = queue.filter((o) => !sent.has(o.id));
      await persist();
    }
    const fresh = await fetchAll();
    if (g !== generation) return;
    data = applyLocal(fresh, queue);
    hydrated = true;
    await persist();
  } catch (e) {
    if (g === generation) error = String((e as any)?.message ?? e);
  } finally {
    syncing = false;
    if (g === generation) loading = false;
    emit();
    if (g !== generation && owner) void sync();
    else if (!error && queue.length && owner && navigator.onLine) void sync();
  }
}
export async function lookupBarcode(code: string) {
  if (!supabase || !owner) throw Error('Sign in to look up products');
  const { data: food, error } = await supabase
    .from('foods')
    .select('*')
    .eq('user_id', owner)
    .eq('barcode', code)
    .maybeSingle();
  if (error) throw error;
  if (food) return { status: 'saved', food };
  const result = await supabase.functions.invoke('food-lookup', { body: { barcode: code } });
  if (result.error)
    return {
      status: 'unavailable',
      message: result.data?.message ?? 'Lookup unavailable. You can enter nutrition manually.',
    };
  return result.data;
}
export async function serverBackup(): Promise<Data> {
  if (!supabase || !owner) throw Error('Supabase is not connected');
  if (queue.length) throw Error('Sync pending changes first');
  const uid = owner;
  const { data: payload, error } = await supabase.rpc('export_backup');
  if (error) throw error;
  if (uid !== owner) throw Error('Account changed during export');
  return payload.data;
}
export async function discardPending() {
  if (syncing) throw Error('Wait for syncing to finish');
  if (!supabase || !owner) throw Error('Sign in first');
  const uid = owner;
  const fresh = await fetchAll();
  if (uid !== owner) throw Error('Account changed');
  queue = [];
  data = fresh;
  error = '';
  await persist();
  emit();
}
export async function restore(data: Data) {
  if (queue.length) throw Error('Sync pending changes before restoring');
  if (!supabase || !owner) throw Error('Supabase is not connected');
  const uid = owner;
  const { error } = await supabase.rpc('restore_backup', {
    payload: { version: 1, expected_owner: uid, data },
  });
  if (error) throw error;
  if (uid !== owner) throw Error('Account changed during restore');
  await refresh();
}
window.addEventListener('online', () => void sync());
window.addEventListener('focus', () => void sync());
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) void sync();
});
