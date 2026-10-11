import { it, expect } from 'vitest';
import { validateBackup, csv } from '../src/backup';
import { emptyData } from '../src/types';
import { unknown } from '../src/nutrition';
it('round trips versioned complete backups and rejects versions, malformed nutrition and duplicate IDs', () => {
  const data = emptyData();
  data.diary_entries.push({
    id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    date: '2026-10-11',
    meal: 'Lunch',
    name: 'Dal, "home"',
    food_id: null,
    quantity: 0.5,
    unit: 'serving',
    nutrition: { ...unknown(), calories: 200 },
    portion_snapshot: {},
  });
  expect(validateBackup({ version: 1, data })).toEqual(data);
  expect(csv(data)).toContain('"Dal, ""home"""');
  expect(csv(data)).not.toContain('"null"');
  expect(() => validateBackup({ version: 2, data })).toThrow();
  expect(() =>
    validateBackup({
      version: 1,
      data: { ...data, diary_entries: [...data.diary_entries, ...data.diary_entries] },
    }),
  ).toThrow('duplicate');
  const bad = structuredClone(data);
  bad.diary_entries[0].nutrition.protein = -1;
  expect(() => validateBackup({ version: 1, data: bad })).toThrow('protein');
});
it('rejects missing referenced ingredients and duplicate barcodes', () => {
  const data = emptyData();
  data.recipe_ingredients.push({
    id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    recipe_id: crypto.randomUUID(),
    food_id: crypto.randomUUID(),
    quantity: 1,
    unit: 'g',
    name: 'X',
    nutrition: unknown(),
  });
  expect(() => validateBackup({ version: 1, data })).toThrow('reference');
});

it('rejects impossible calendar dates and missing nutrition before preview', () => {
  const data = emptyData();
  const e = {
    id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    date: '2026-02-31',
    meal: 'Lunch' as const,
    name: 'Test',
    quantity: 1,
    unit: 'entry',
    food_id: null,
    nutrition: unknown(),
    portion_snapshot: {},
  };
  data.diary_entries.push(e);
  expect(() => validateBackup({ version: 1, data })).toThrow('date');
  e.date = '2026-02-28';
  delete (e as any).nutrition;
  expect(() => validateBackup({ version: 1, data })).toThrow('nutrition');
});
