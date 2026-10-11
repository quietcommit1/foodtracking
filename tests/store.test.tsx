import { it, expect, vi, beforeAll, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { emptyData, type Food } from '../src/types';
import { unknown, normalizeBarcode } from '../src/nutrition';
const mock = vi.hoisted(() => ({
  data: {} as any,
  seen: new Set<string>(),
  calls: [] as any[],
  fail: false,
  external: vi.fn(),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      let key = '',
        value: any;
      const q: any = {
        select: () => q,
        eq: (k: string, v: any) => {
          key = k;
          value = v;
          return q;
        },
        order: () => q,
        range: async () => ({ data: mock.data[table] ?? [], error: null }),
        maybeSingle: async () => ({
          data: (mock.data[table] ?? []).find((r: any) => r[key] === value) ?? null,
          error: null,
        }),
      };
      return q;
    },
    functions: { invoke: mock.external },
    rpc: async (name: string, { ops }: any) => {
      mock.calls.push(ops);
      if (mock.fail) return { error: { message: 'Project unavailable' } };
      for (const o of ops) {
        if (mock.seen.has(o.id)) continue;
        mock.seen.add(o.id);
        let rows = mock.data[o.table] ?? [];
        rows = rows.filter((r: any) => r.id !== o.row.id);
        if (o.action === 'upsert') rows.push(o.row);
        mock.data[o.table] = rows;
      }
      return { error: null };
    },
  }),
}));
let store: typeof import('../src/store');
const uid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const uid2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const online = (value: boolean) =>
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
beforeAll(async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'public-test-key');
  store = await import('../src/store');
});
afterEach(async () => {
  await store.setAccount(null);
  mock.data = emptyData();
  mock.calls = [];
  mock.seen.clear();
  mock.fail = false;
  online(true);
});
it('queues offline edits and retries stable IDs without duplicate entries', async () => {
  online(false);
  await store.setAccount(uid);
  const { result } = renderHook(() => store.useStore());
  const row = {
    id: crypto.randomUUID(),
    user_id: uid,
    date: '2026-10-11',
    meal: 'Lunch',
    name: 'Quick lunch',
    quantity: 1,
    unit: 'entry',
    food_id: null,
    nutrition: { ...unknown(), calories: 100 },
    portion_snapshot: { quick: true },
  };
  const operation = store.op('diary_entries', row);
  await act(() => store.mutate([operation]));
  expect(result.current.data.diary_entries).toHaveLength(1);
  expect(result.current.queue[0].id).toBe(operation.id);
  online(true);
  mock.fail = true;
  await act(() => store.sync());
  expect(result.current.error).toBe('Project unavailable');
  expect(result.current.queue).toHaveLength(1);
  mock.fail = false;
  await act(() => store.sync());
  expect(result.current.queue).toHaveLength(0);
  expect(mock.data.diary_entries).toHaveLength(1);
  expect(mock.calls[0][0].id).toBe(mock.calls[1][0].id);
  await act(() => store.sync());
  expect(mock.data.diary_entries).toHaveLength(1);
});
it('keeps offline data and queues scoped to their original account', async () => {
  online(false);
  await store.setAccount(uid);
  const { result } = renderHook(() => store.useStore());
  const before = result.current.data.diary_entries.length;
  await act(() =>
    store.mutate([
      store.op('diary_entries', {
        ...store.base(),
        date: '2026-10-11',
        meal: 'Snacks',
        name: 'Tea',
        food_id: null,
        quantity: 1,
        unit: 'entry',
        nutrition: unknown(),
        portion_snapshot: {},
      }),
    ]),
  );
  await act(() => store.setAccount(uid2));
  expect(result.current.queue).toHaveLength(0);
  expect(result.current.data.diary_entries).toHaveLength(0);
  await expect(
    store.mutate([store.op('foods', { id: crypto.randomUUID(), user_id: uid })]),
  ).rejects.toThrow('Account changed');
  await act(() => store.setAccount(uid));
  expect(result.current.queue.length).toBeGreaterThan(0);
  expect(result.current.data.diary_entries.length).toBe(before + 1);
});
it('manual product sync makes later saved barcode lookups bypass the external function', async () => {
  await store.setAccount(uid2);
  const food: Food = {
    ...store.base(),
    name: 'Indian packaged snack',
    brand: 'Regional brand',
    barcode: normalizeBarcode('012345678905'),
    basis: 'g',
    basis_amount: 100,
    serving_size: null,
    nutrition: { ...unknown(), calories: 400 },
    notes: '',
    source: 'manual',
    source_id: null,
    source_url: null,
    source_data: null,
    state: 'packaged',
  };
  const { result } = renderHook(() => store.useStore());
  await act(() => store.mutate([store.op('foods', food)]));
  await waitFor(() => expect(result.current.queue).toHaveLength(0));
  const found = await store.lookupBarcode(food.barcode!);
  expect(found.status).toBe('saved');
  expect(found.food.name).toBe(food.name);
  expect(mock.external).not.toHaveBeenCalled();
});
