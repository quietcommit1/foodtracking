import { describe, it, expect } from 'vitest';
import {
  scale,
  total,
  unknown,
  zero,
  portionNutrition,
  recipeNutrition,
  makeSnapshot,
  localDate,
  offsetDate,
  targetAt,
  normalizeBarcode,
  historySummary,
} from '../src/nutrition';
import { externalFood } from '../src/off';
import { type Food } from '../src/types';
const f: Food = {
  id: crypto.randomUUID(),
  user_id: crypto.randomUUID(),
  name: 'Paneer',
  brand: '',
  barcode: null,
  basis: 'g',
  basis_amount: 100,
  serving_size: 50,
  nutrition: { calories: 300, protein: 20, carbs: 4, fat: 24, fibre: null },
  notes: '',
  source: 'manual',
  source_id: null,
  source_url: null,
  source_data: null,
  state: 'packaged',
};
describe('nutrition and dates', () => {
  it('scales fractional grams and servings without losing unknowns', () => {
    expect(portionNutrition(f, 25, 'g')).toEqual({
      calories: 75,
      protein: 5,
      carbs: 1,
      fat: 6,
      fibre: null,
    });
    expect(portionNutrition(f, 0.5, 'serving').calories).toBe(75);
    expect(() => portionNutrition(f, 10, 'ml')).toThrow('conversion');
    expect(() => portionNutrition(f, -1, 'g')).toThrow();
  });
  it('computes cooked yield and propagates missing nutrients', () => {
    const n = recipeNutrition([f.nutrition, { ...f.nutrition, protein: null }], 4, 800);
    expect(n.batch.calories).toBe(600);
    expect(n.per100g?.calories).toBe(75);
    expect(n.perServing.calories).toBe(150);
    expect(n.per100g?.protein).toBeNull();
    expect(total([])).toEqual(zero());
    expect(scale(unknown(), 2)).toEqual(unknown());
  });
  it('snapshots remain independent from food edits', () => {
    const snapshot = makeSnapshot(f, 50, 'g');
    const original = snapshot.nutrition.calories;
    f.nutrition.calories = 400;
    expect(snapshot.nutrition.calories).toBe(original);
    f.nutrition.calories = 300;
  });
  it('uses local dates around midnight and handles month boundaries', () => {
    expect(localDate(new Date(2026, 9, 11, 0, 1))).toBe('2026-10-11');
    expect(localDate(new Date(2026, 9, 10, 23, 59))).toBe('2026-10-10');
    expect(offsetDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(offsetDate('2024-03-01', -1)).toBe('2024-02-29');
  });
  it('preserves effective-dated targets', () => {
    const targets = [
      {
        id: 'a',
        user_id: 'u',
        effective_date: '2026-10-01',
        nutrition: { ...zero(), calories: 2000 },
      },
      {
        id: 'b',
        user_id: 'u',
        effective_date: '2026-10-11',
        nutrition: { ...zero(), calories: 2100 },
      },
    ];
    expect(targetAt(targets, '2026-10-10').calories).toBe(2000);
    expect(targetAt(targets, '2026-09-01').calories).toBeNull();
  });
  it('normalizes UPC-A to EAN13 and retains leading zeros', () => {
    expect(normalizeBarcode('012345678905')).toBe('0012345678905');
    expect(normalizeBarcode('0012345678905')).toBe('0012345678905');
    expect(normalizeBarcode('12345678')).toBe('12345678');
    expect(() => normalizeBarcode('8e12')).toThrow();
  });
  it('excludes unlogged days but includes explicit zero days', () => {
    const stats = historySummary([], [{ date: '2026-10-10', zero_intake: true }], '2026-10-11', 7);
    expect(stats.logged).toBe(1);
    expect(stats.unlogged).toBe(6);
    expect(stats.average.calories).toBe(0);
  });
  it('reads current OFF 3.6 schema including liquid basis, preserves provenance and unknowns', () => {
    const product = {
      product_name: 'Chaas',
      nutrition: {
        aggregated_set: {
          per: '100ml',
          preparation: 'as_sold',
          nutrients: {
            'energy-kcal': { value: 45 },
            proteins: { value: 2 },
            fat: { value: 3, modifier: '<' },
          },
        },
      },
    };
    const food = externalFood(
      {
        product,
        barcode: '8901234567890',
        source_id: '8901234567890',
        source_url: 'https://world.openfoodfacts.org/product/8901234567890',
      },
      { id: 'f', user_id: 'u' },
    );
    expect(food.basis).toBe('ml');
    expect(food.nutrition.calories).toBe(45);
    expect(food.nutrition.carbs).toBeNull();
    expect(food.nutrition.fat).toBeNull();
    expect(food.source_data).toEqual(product);
  });
});

it('per-serving foods convert only their explicitly saved weight or volume', () => {
  const servingFood = {
    ...f,
    basis: 'serving' as const,
    basis_amount: 1,
    serving_size: 250,
    serving_unit: 'ml' as const,
  };
  expect(portionNutrition(servingFood, 125, 'ml').calories).toBe(150);
  expect(() => portionNutrition(servingFood, 125, 'g')).toThrow();
});
