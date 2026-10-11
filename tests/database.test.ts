// Execute the real migration in embedded PostgreSQL; Auth is stubbed, RLS is real.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { emptyData, type Food } from '../src/types';
import { unknown } from '../src/nutrition';
let db: PGlite;
const a = '11111111-1111-4111-8111-111111111111',
  b = '22222222-2222-4222-8222-222222222222';
const fid = '33333333-3333-4333-8333-333333333333';
const food: Food = {
  id: fid,
  user_id: a,
  name: 'Paneer',
  brand: 'Amul',
  barcode: '0890123456789',
  basis: 'g',
  basis_amount: 100,
  serving_size: null,
  nutrition: { ...unknown(), calories: 300 },
  notes: '',
  source: 'manual',
  source_id: null,
  source_url: null,
  source_data: null,
  recipe_id: null,
  state: 'packaged',
};
async function user(id: string) {
  await db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${id}';`);
}
async function ops(items: any[]) {
  return db.query('select public.apply_operations($1::jsonb)', [JSON.stringify(items)]);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;grant usage on schema auth,public to authenticated;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;insert into auth.users values('${a}'),('${b}');`,
  );
  await db.exec(readFileSync('supabase/migrations/202610110001_initial.sql', 'utf8'));
}, 30000);
afterAll(async () => db?.close());
it('enforces isolation for two users and idempotent stable operation IDs', async () => {
  await user(a);
  const op = { id: crypto.randomUUID(), table: 'foods', action: 'upsert', row: food };
  await ops([op]);
  await ops([op]);
  expect((await db.query('select * from foods')).rows).toHaveLength(1);
  await user(b);
  expect((await db.query('select * from foods')).rows).toHaveLength(0);
  await expect(
    db.query('insert into foods select (jsonb_populate_record(null::foods,$1)).*', [
      JSON.stringify({ ...food, id: crypto.randomUUID() }),
    ]),
  ).rejects.toThrow(/row-level/);
  await db.query('update foods set name=$1 where id=$2', ['Attack', fid]);
  await user(a);
  expect((await db.query<{ name: string }>('select name from foods')).rows[0].name).toBe('Paneer');
});
it('blocks duplicate barcode and cross-account ingredient/portion references', async () => {
  await user(a);
  await expect(
    ops([
      {
        id: crypto.randomUUID(),
        table: 'foods',
        action: 'upsert',
        row: { ...food, id: crypto.randomUUID() },
      },
    ]),
  ).rejects.toThrow(/unique/);
  await user(b);
  await expect(
    ops([
      {
        id: crypto.randomUUID(),
        table: 'food_portions',
        action: 'upsert',
        row: {
          id: crypto.randomUUID(),
          user_id: b,
          food_id: fid,
          name: 'bowl',
          quantity: 100,
          unit: 'g',
        },
      },
    ]),
  ).rejects.toThrow(/foreign key/);
  const recipeId = crypto.randomUUID();
  await ops([
    {
      id: crypto.randomUUID(),
      table: 'recipes',
      action: 'upsert',
      row: { id: recipeId, user_id: b, name: 'Dal', servings: 4, cooked_weight: null, notes: '' },
    },
  ]);
  await expect(
    ops([
      {
        id: crypto.randomUUID(),
        table: 'recipe_ingredients',
        action: 'upsert',
        row: {
          id: crypto.randomUUID(),
          user_id: b,
          recipe_id: recipeId,
          food_id: fid,
          name: 'Paneer',
          quantity: 100,
          unit: 'g',
          nutrition: food.nutrition,
        },
      },
    ]),
  ).rejects.toThrow(/foreign key/);
});
it('keeps diary snapshots when a library food changes or is deleted', async () => {
  await user(a);
  const eid = crypto.randomUUID();
  await ops([
    {
      id: crypto.randomUUID(),
      table: 'diary_entries',
      action: 'upsert',
      row: {
        id: eid,
        user_id: a,
        date: '2026-10-11',
        meal: 'Lunch',
        name: 'Paneer',
        food_id: fid,
        quantity: 100,
        unit: 'g',
        nutrition: food.nutrition,
        portion_snapshot: { basis: 'g', basis_amount: 100 },
      },
    },
  ]);
  await ops([
    {
      id: crypto.randomUUID(),
      table: 'foods',
      action: 'upsert',
      row: { ...food, nutrition: { ...food.nutrition, calories: 500 } },
    },
  ]);
  expect(
    (await db.query<any>('select nutrition from diary_entries where id=$1', [eid])).rows[0]
      .nutrition.calories,
  ).toBe(300);
  await ops([
    { id: crypto.randomUUID(), table: 'foods', action: 'delete', row: { id: fid, user_id: a } },
  ]);
  expect((await db.query('select * from diary_entries where id=$1', [eid])).rows).toHaveLength(1);
});
it('restores transactionally, reassigns ownership and rolls back invalid imports', async () => {
  await user(a);
  const data = emptyData();
  data.foods.push({ ...food, user_id: b });
  await db.query('select restore_backup($1::jsonb)', [
    JSON.stringify({ version: 1, expected_owner: a, data }),
  ]);
  expect((await db.query<any>('select user_id from foods')).rows[0].user_id).toBe(a);
  const bad = structuredClone(data);
  bad.foods.push({ ...food, id: crypto.randomUUID() });
  await expect(
    db.query('select restore_backup($1::jsonb)', [
      JSON.stringify({ version: 1, expected_owner: a, data: bad }),
    ]),
  ).rejects.toThrow(/unique/);
  expect((await db.query('select * from foods')).rows).toHaveLength(1);
  await user(b);
  expect((await db.query('select * from foods')).rows).toHaveLength(0);
});
it('rejects null nutrients missing keys and negative nutrition', async () => {
  await user(a);
  await expect(
    ops([
      {
        id: crypto.randomUUID(),
        table: 'foods',
        action: 'upsert',
        row: { ...food, id: crypto.randomUUID(), barcode: null, nutrition: { calories: -1 } },
      },
    ]),
  ).rejects.toThrow();
});

it('rejects operations accidentally sent by another signed-in account', async () => {
  await user(b);
  await expect(
    ops([{ id: crypto.randomUUID(), table: 'foods', action: 'upsert', row: food }]),
  ).rejects.toThrow('account mismatch');
});
