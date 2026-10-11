import { tables, type Data, nutrientKeys } from './types';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateBackup(input: unknown): Data {
  const b = input as any;
  if (!b || b.version !== 1 || !b.data) throw Error('Expected an Everyday version 1 backup');
  const nutritionTables = [
    'foods',
    'recipe_ingredients',
    'diary_entries',
    'nutrition_targets',
    'saved_meal_items',
  ];
  const isDate = (s: unknown) =>
    typeof s === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s + 'T12:00:00Z')) &&
    new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s;
  const positive = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0;
  for (const t of tables) {
    if (!Array.isArray(b.data[t]) || b.data[t].length > 50000) throw Error(`Invalid ${t}`);
    const seen = new Set();
    for (const r of b.data[t]) {
      if (!r || !uuid.test(r.id) || seen.has(r.id)) throw Error(`Invalid or duplicate ID in ${t}`);
      seen.add(r.id);
      if (nutritionTables.includes(t) && (!r.nutrition || typeof r.nutrition !== 'object'))
        throw Error(`Missing nutrition in ${t}`);
      if (t === 'foods') {
        if (!['g', 'ml', 'serving'].includes(r.basis) || !positive(r.basis_amount))
          throw Error('Invalid nutrition basis');
        if (r.serving_size !== null && !positive(r.serving_size))
          throw Error('Invalid serving size');
        if (
          !['manual', 'openfoodfacts', 'recipe'].includes(r.source) ||
          !['raw', 'cooked', 'packaged'].includes(r.state)
        )
          throw Error('Invalid food provenance or state');
        if (r.barcode !== null && !/^([0-9]{8}|[0-9]{13}|[0-9]{14})$/.test(r.barcode))
          throw Error('Invalid barcode');
      }
      if (
        t === 'recipes' &&
        (!positive(r.servings) || (r.cooked_weight !== null && !positive(r.cooked_weight)))
      )
        throw Error('Invalid recipe yield');
      if (['diary_entries', 'diary_days'].includes(t) && !isDate(r.date))
        throw Error('Invalid diary date');
      if (t === 'nutrition_targets' && !isDate(r.effective_date))
        throw Error('Invalid target date');
      if (t === 'diary_entries' && !['Breakfast', 'Lunch', 'Dinner', 'Snacks'].includes(r.meal))
        throw Error('Invalid meal');
      if (r.nutrition) {
        for (const k of nutrientKeys)
          if (
            r.nutrition[k] !== null &&
            (typeof r.nutrition[k] !== 'number' ||
              !Number.isFinite(r.nutrition[k]) ||
              r.nutrition[k] < 0)
          )
            throw Error(`Invalid ${k} in ${t}`);
      }
      if (r.quantity !== undefined && (!(r.quantity > 0) || !Number.isFinite(r.quantity)))
        throw Error('Invalid quantity');
      if (r.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) throw Error('Invalid date');
      if (
        ['foods', 'recipes', 'saved_meals', 'diary_entries', 'saved_meal_items'].includes(t) &&
        !(typeof r.name === 'string' && r.name.trim())
      )
        throw Error('Missing name');
    }
  }
  const exists = (t: string, id: string) => b.data[t].some((r: any) => r.id === id);
  for (const r of b.data.foods)
    if (r.recipe_id && !exists('recipes', r.recipe_id))
      throw Error('Missing recipe food reference');
  for (const r of b.data.food_portions)
    if (!exists('foods', r.food_id)) throw Error('Missing portion food');
  for (const r of b.data.recipe_ingredients)
    if (!exists('recipes', r.recipe_id) || !exists('foods', r.food_id))
      throw Error('Missing recipe ingredient reference');
  for (const r of b.data.favourites)
    if (!exists('foods', r.food_id)) throw Error('Missing favourite food');
  for (const r of b.data.saved_meal_items)
    if (!exists('saved_meals', r.saved_meal_id)) throw Error('Missing saved meal');
  const barcodes = b.data.foods.filter((f: any) => f.barcode).map((f: any) => f.barcode);
  if (new Set(barcodes).size !== barcodes.length) throw Error('Duplicate barcodes');
  return b.data;
}
export function csv(data: Data) {
  const escape = (s: unknown) => '"' + String(s ?? '').replaceAll('"', '""') + '"';
  return [
    ['date', 'meal', 'food', 'quantity', 'unit', 'calories', 'protein', 'carbs', 'fat', 'fibre'],
    ...data.diary_entries.map((e) => [
      e.date,
      e.meal,
      e.name,
      e.quantity,
      e.unit,
      ...nutrientKeys.map((k) => e.nutrition[k]),
    ]),
  ]
    .map((r) => r.map(escape).join(','))
    .join('\r\n');
}
export function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
