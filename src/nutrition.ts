import { type Nutrition, nutrientKeys, type Food, type Target, type Entry } from './types';
export const unknown = (): Nutrition => ({
  calories: null,
  protein: null,
  carbs: null,
  fat: null,
  fibre: null,
});
export const zero = (): Nutrition => ({ calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 });
export function scale(n: Nutrition, factor: number): Nutrition {
  if (!Number.isFinite(factor) || factor < 0) throw Error('Quantity must be non-negative');
  return Object.fromEntries(
    nutrientKeys.map((k) => [k, n[k] === null ? null : n[k]! * factor]),
  ) as Nutrition;
}
export function total(ns: Nutrition[]): Nutrition {
  return Object.fromEntries(
    nutrientKeys.map((k) => [
      k,
      ns.some((n) => n[k] === null) ? null : ns.reduce((s, n) => s + n[k]!, 0),
    ]),
  ) as Nutrition;
}
export function knownTotal(ns: Nutrition[], k: keyof Nutrition) {
  return {
    value: ns.reduce((s, n) => s + (n[k] ?? 0), 0),
    incomplete: ns.some((n) => n[k] === null),
  };
}
export function portionNutrition(food: Food, quantity: number, unit: string): Nutrition {
  if (!Number.isFinite(quantity) || quantity <= 0) throw Error('Enter a positive quantity');
  let amount = quantity;
  if (unit !== food.basis) {
    if (unit === 'serving' && food.serving_size && food.basis !== 'serving')
      amount *= food.serving_size;
    else if (food.basis === 'serving' && food.serving_size && unit === food.serving_unit)
      amount /= food.serving_size;
    else throw Error('No saved conversion for this portion. Use the nutrition basis unit.');
  }
  return scale(food.nutrition, amount / food.basis_amount);
}
export function recipeNutrition(ingredients: Nutrition[], servings: number, weight: number | null) {
  if (
    !Number.isFinite(servings) ||
    servings <= 0 ||
    (weight !== null && (!Number.isFinite(weight) || weight <= 0))
  )
    throw Error('Recipe yield must be positive');
  const batch = total(ingredients);
  return {
    batch,
    perServing: scale(batch, 1 / servings),
    per100g: weight ? scale(batch, 100 / weight) : null,
  };
}
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function offsetDate(date: string, n: number) {
  const [y, m, d] = date.split('-').map(Number);
  return localDate(new Date(y, m - 1, d + n, 12));
}
export function targetAt(targets: Target[], date: string) {
  return (
    [...targets]
      .filter((t) => t.effective_date <= date)
      .sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0]?.nutrition ?? unknown()
  );
}
export function normalizeBarcode(input: string, format = 'auto') {
  let s = input.trim();
  if (format === 'UPC-E') {
    if (!/^[01]\d{7}$/.test(s)) throw Error('UPC-E requires 8 digits with number system 0 or 1');
    const d = s.slice(1, 7),
      last = d[5];
    const expanded = ['0', '1', '2'].includes(last)
      ? d.slice(0, 2) + last + '0000' + d.slice(2, 5)
      : last === '3'
        ? d.slice(0, 3) + '00000' + d.slice(3, 5)
        : last === '4'
          ? d.slice(0, 4) + '00000' + d[4]
          : d.slice(0, 5) + '0000' + last;
    s = s[0] + expanded + s[7];
  }
  if (!/^\d{8}$|^\d{12,14}$/.test(s))
    throw Error('Use 8, 12, 13 or 14 barcode digits. Leading zeros are preserved.');
  return s.length === 12 ? '0' + s : s.length === 14 && s[0] === '0' ? s.slice(1) : s;
}
export function fmt(n: number | null) {
  return n === null
    ? 'Unknown'
    : new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n);
}
export function makeSnapshot(food: Food, quantity: number, unit: string) {
  return {
    name: food.name,
    food_id: food.id,
    quantity,
    unit,
    nutrition: portionNutrition(food, quantity, unit),
    portion_snapshot: {
      basis: food.basis,
      basis_amount: food.basis_amount,
      serving_size: food.serving_size,
      serving_unit: food.serving_unit,
      source: food.source,
      source_url: food.source_url,
      state: food.state,
    },
  };
}
export function historySummary(
  entries: Entry[],
  days: { date: string; zero_intake: boolean }[],
  end: string,
  count: number,
) {
  const dates = Array.from({ length: count }, (_, i) => offsetDate(end, -i));
  const logged = dates.filter(
    (d) => entries.some((e) => e.date === d) || days.some((x) => x.date === d && x.zero_intake),
  );
  const summaries = logged.map((d) =>
    total(entries.filter((e) => e.date === d).map((e) => e.nutrition)),
  );
  const sums = total(summaries);
  return {
    logged: logged.length,
    unlogged: count - logged.length,
    average: logged.length ? scale(sums, 1 / logged.length) : unknown(),
  };
}
