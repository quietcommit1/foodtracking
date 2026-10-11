import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
const required = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_TEST_EMAIL_A',
  'SUPABASE_TEST_PASSWORD_A',
  'SUPABASE_TEST_EMAIL_B',
  'SUPABASE_TEST_PASSWORD_B',
];
for (const name of required)
  if (!process.env[name])
    throw new Error(
      `Missing ${name}; set it in ignored .env.local. Never paste passwords in chat.`,
    );
const url = process.env.VITE_SUPABASE_URL,
  key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const client = () =>
  createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const a = client(),
  b = client();
let uid;
const ids = { food: crypto.randomUUID(), recipe: crypto.randomUUID(), entry: crypto.randomUUID() };
const nutrients = { calories: 123, protein: null, carbs: 10, fat: 2, fibre: null };
const operation = (table, row, action = 'upsert') => ({
  id: crypto.randomUUID(),
  table,
  row,
  action,
});
async function apply(db, ops) {
  const result = await db.rpc('apply_operations', { ops });
  if (result.error) throw result.error;
}
try {
  for (const [db, suffix] of [
    [a, 'A'],
    [b, 'B'],
  ]) {
    const result = await db.auth.signInWithPassword({
      email: process.env[`SUPABASE_TEST_EMAIL_${suffix}`],
      password: process.env[`SUPABASE_TEST_PASSWORD_${suffix}`],
    });
    assert.equal(result.error, null, 'Test account sign-in failed');
  }
  uid = (await a.auth.getUser()).data.user.id;
  const other = (await b.auth.getUser()).data.user.id;
  assert.notEqual(uid, other, 'Use two different test accounts');
  const food = {
    id: ids.food,
    user_id: uid,
    name: 'Automated security fixture — delete after test',
    brand: 'Test',
    barcode: '0000000000000',
    basis: 'g',
    basis_amount: 100,
    serving_size: null,
    serving_unit: null,
    nutrition: nutrients,
    notes: '',
    source: 'manual',
    source_id: null,
    source_url: null,
    source_data: null,
    recipe_id: null,
    state: 'packaged',
  };
  const op = operation('foods', food);
  await apply(a, [op]);
  await apply(a, [op]);
  const own = await a.from('foods').select('*').eq('id', ids.food);
  assert.equal(own.data.length, 1);
  assert.equal(
    (await b.from('foods').select('*').eq('id', ids.food)).data.length,
    0,
    'RLS leaked another account food',
  );
  const dup = await a.rpc('apply_operations', {
    ops: [operation('foods', { ...food, id: crypto.randomUUID() })],
  });
  assert(dup.error, 'Duplicate barcode accepted');
  const cross = await b.rpc('apply_operations', {
    ops: [
      operation('food_portions', {
        id: crypto.randomUUID(),
        user_id: other,
        food_id: ids.food,
        name: 'bowl',
        quantity: 100,
        unit: 'g',
      }),
    ],
  });
  assert(cross.error, 'Cross-account food reference accepted');
  await apply(a, [
    operation('recipes', {
      id: ids.recipe,
      user_id: uid,
      name: 'Security test recipe',
      servings: 1,
      cooked_weight: 100,
      notes: '',
    }),
    operation('recipe_ingredients', {
      id: crypto.randomUUID(),
      user_id: uid,
      recipe_id: ids.recipe,
      food_id: ids.food,
      name: food.name,
      quantity: 100,
      unit: 'g',
      nutrition: nutrients,
    }),
    operation('diary_entries', {
      id: ids.entry,
      user_id: uid,
      date: '2000-01-01',
      meal: 'Snacks',
      food_id: ids.food,
      name: food.name,
      quantity: 100,
      unit: 'g',
      nutrition: nutrients,
      portion_snapshot: { basis: 'g', basis_amount: 100 },
    }),
  ]);
  for (const [table, id] of [
    ['recipes', ids.recipe],
    ['diary_entries', ids.entry],
  ])
    assert.equal((await b.from(table).select('id').eq('id', id)).data.length, 0, `${table} leaked`);
  await apply(a, [operation('foods', { ...food, nutrition: { ...nutrients, calories: 500 } })]);
  assert.equal(
    (await a.from('diary_entries').select('nutrition').eq('id', ids.entry).single()).data.nutrition
      .calories,
    123,
    'Historical nutrition changed',
  );
  const saved = await a.functions.invoke('food-lookup', { body: { barcode: food.barcode } });
  assert.equal(saved.error, null, 'Edge function failed');
  assert.equal(saved.data.status, 'saved', 'Saved barcode did not bypass OFF');
  const unauth = await fetch(`${url}/functions/v1/food-lookup`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ barcode: food.barcode }),
  });
  assert.equal(unauth.status, 401, 'Unauthenticated Edge lookup accepted');
  console.log(
    'Hosted checks passed: Auth, two-user RLS, child ownership, duplicate barcode, idempotency, snapshots, saved Edge lookup and unauthenticated rejection.',
  );
} finally {
  if (uid) {
    await apply(a, [
      operation('diary_entries', { id: ids.entry, user_id: uid }, 'delete'),
      operation('recipes', { id: ids.recipe, user_id: uid }, 'delete'),
      operation('foods', { id: ids.food, user_id: uid }, 'delete'),
    ]);
  }
  await a.auth.signOut();
  await b.auth.signOut();
}
