import { it, expect } from 'vitest';
import { externalFood } from '../src/off';
const read = (product: unknown) =>
  externalFood(
    {
      product,
      barcode: '3017620422003',
      source_id: '3017620422003',
      source_url: 'https://world.openfoodfacts.org/product/3017620422003',
    },
    { id: 'f', user_id: 'u' },
  );
it('reads OFF v2 nutriments, including numeric strings and genuine zeros', () => {
  const f = read({
    product_name: 'Labelled product',
    nutriments: {
      'energy-kcal_100g': 345,
      proteins_100g: '52',
      carbohydrates_100g: 33,
      fat_100g: 0,
      fiber_100g: '',
    },
  });
  expect(f.nutrition).toEqual({ calories: 345, protein: 52, carbs: 33, fat: 0, fibre: null });
});
it('uses legacy normalized values when a new aggregated set is incomplete', () => {
  const f = read({
    nutrition: {
      aggregated_set: {
        per: '100g',
        nutrients: { proteins: { value: 2 }, fat: { value: 1, modifier: '<' } },
      },
    },
    nutriments: { 'energy-kcal_100g': 45, carbohydrates_100g: 4, fat_100g: 1 },
  });
  expect(f.nutrition).toEqual({ calories: 45, protein: 2, carbs: 4, fat: null, fibre: null });
});
it('converts explicit kJ and preserves liquid or serving bases', () => {
  expect(
    read({ nutrition_data_per: '100ml', nutriments: { 'energy-kj_100g': 418.4 } }).nutrition
      .calories,
  ).toBeCloseTo(100);
  expect(read({ nutrition_data_per: '100ml', nutriments: { fat_100g: 3 } }).basis).toBe('ml');
  const f = read({
    nutrition_data_per: 'serving',
    serving_quantity: 30,
    serving_quantity_unit: 'g',
    nutriments: { 'energy-kcal_serving': 100, proteins_serving: 4 },
  });
  expect(f.basis).toBe('serving');
  expect(f.basis_amount).toBe(1);
  expect(f.serving_size).toBe(30);
  expect(f.nutrition.protein).toBe(4);
});
