import { describe, it, expect } from 'vitest';
import { catalog, catalogDraft, searchCatalog, matchesFood } from '../src/catalog';
import { makeSnapshot } from '../src/nutrition';
describe('starter food library', () => {
  it('finds Indian aliases and differentiates dry and cooked food', () => {
    expect(searchCatalog('soy chunks')[0]?.id).toBe('soya-chunks');
    expect(searchCatalog('soya chunks')[0]?.id).toBe('soya-chunks');
    expect(searchCatalog('meal maker')[0]?.id).toBe('soya-chunks');
    expect(searchCatalog('चावल cooked').map((f) => f.id)).toEqual(['rice-cooked']);
    expect(searchCatalog('rajma').map((f) => f.id)).toEqual(['rajma-dry', 'rajma-cooked']);
  });
  it('preserves uncertainty, source and account ownership in a fractional log', () => {
    const item = catalog.find((f) => f.id === 'soya-chunks')!;
    const food = catalogDraft(item, { id: 'food-id', user_id: 'account-id' });
    const snapshot = makeSnapshot(food, 25, 'g');
    expect(snapshot.nutrition).toEqual({
      calories: 86.25,
      protein: 13,
      carbs: 8.25,
      fat: 0.125,
      fibre: null,
    });
    expect(matchesFood(food, 'meal maker')).toBe(true);
    expect(food.user_id).toBe('account-id');
    expect(food.barcode).toBeNull();
    expect(food.notes).toMatch(/not verified/);
    food.nutrition.protein = 1;
    expect(item.nutrition.protein).toBe(52);
    expect((food.source_data as any).nutrition.protein).toBe(52);
  });
});

it('loads 8,789 distinct USDA references with original macro values and source provenance', async () => {
  const { loadReferenceCatalog } = await import('../src/catalog');
  const reference = await loadReferenceCatalog();
  expect(reference).toHaveLength(8789);
  expect(new Set(reference.map((food) => food.id)).size).toBe(8789);
  const butter = reference.find((food) => food.id === 'usda-sr28:01001')!;
  expect(butter.nutrition).toEqual({
    calories: 717,
    protein: 0.85,
    carbs: 0.06,
    fat: 81.11,
    fibre: 0,
  });
  const food = catalogDraft(butter, { id: 'f', user_id: 'u' });
  expect(food.source_id).toBe('usda-sr28:01001');
  expect(food.notes).toMatch(/historical reference/);
  expect(food.source_url).toContain('fdc.nal.usda.gov');
  expect(searchCatalog('lentils raw', reference).length).toBeGreaterThan(0);
  for (const food of reference)
    for (const value of Object.values(food.nutrition))
      expect(value === null || (Number.isFinite(value) && value >= 0)).toBe(true);
});
