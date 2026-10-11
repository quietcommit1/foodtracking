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
