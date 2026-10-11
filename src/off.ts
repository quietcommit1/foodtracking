import { type Food, nutrientKeys } from './types';
import { unknown } from './nutrition';
function value(raw: unknown): number | null {
  if (typeof raw !== 'number' && (typeof raw !== 'string' || !/^\d+(\.\d+)?$/.test(raw.trim())))
    return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function externalFood(result: any, identity: { id: string; user_id: string }): Food {
  const p = result.product ?? {};
  const set = p.nutrition?.aggregated_set;
  const legacy = p.nutriments;
  const per = set?.per ?? p.nutrition_data_per ?? '100g';
  const servingOnly =
    per === 'serving' &&
    !nutrientKeys.some((k) => {
      const key =
        k === 'calories'
          ? 'energy-kcal'
          : k === 'carbs'
            ? 'carbohydrates'
            : k === 'protein'
              ? 'proteins'
              : k === 'fibre'
                ? 'fiber'
                : 'fat';
      return value(legacy?.[`${key}_100g`]) !== null;
    });
  const basis = servingOnly ? 'serving' : per === '100ml' ? 'ml' : 'g';
  const suffix = servingOnly ? 'serving' : '100g';
  const usableSet =
    set && (set.per === '100g' || set.per === '100ml' || (set.per === 'serving' && servingOnly));
  const nutrition = unknown();
  for (const k of nutrientKeys) {
    const key =
      k === 'calories'
        ? 'energy-kcal'
        : k === 'carbs'
          ? 'carbohydrates'
          : k === 'protein'
            ? 'proteins'
            : k === 'fat'
              ? 'fat'
              : 'fiber';
    const item = usableSet ? set.nutrients?.[key] : undefined;
    // An inequality is genuinely unknown. Do not replace it with a contradictory legacy value.
    nutrition[k] = item?.modifier
      ? null
      : (value(item?.value) ?? value(legacy?.[`${key}_${suffix}`]));
  }
  if (nutrition.calories === null) {
    const kj = usableSet ? set.nutrients?.['energy-kj'] : undefined;
    if (!kj?.modifier && !set?.nutrients?.['energy-kcal']?.modifier) {
      const energy =
        value(kj?.value) ??
        value(legacy?.[`energy-kj_${suffix}`]) ??
        (legacy?.energy_unit === 'kJ' ? value(legacy?.[`energy_${suffix}`]) : null);
      if (energy !== null) nutrition.calories = energy / 4.184;
    }
  }
  const servingUnit =
    p.serving_quantity_unit === 'g' || p.serving_quantity_unit === 'ml'
      ? p.serving_quantity_unit
      : null;
  const servingSize = servingUnit ? value(p.serving_quantity) : null;
  return {
    ...identity,
    name: p.product_name ?? p.product_name_en ?? '',
    brand: p.brands ?? '',
    barcode: result.barcode,
    basis,
    basis_amount: servingOnly ? 1 : 100,
    serving_size: servingSize && servingSize > 0 ? servingSize : null,
    serving_unit: servingUnit,
    nutrition,
    notes: [
      p.serving_size
        ? `Source serving description: ${p.serving_size}. Check any serving conversion against the label.`
        : '',
      set?.preparation === 'prepared'
        ? 'External nutrition is for the prepared product. Confirm preparation.'
        : '',
      nutrientKeys.slice(0, 4).some((k) => nutrition[k] === null)
        ? 'Some source nutrients are missing. Fill only values known from the label; blanks remain unknown.'
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
    source: 'openfoodfacts',
    source_id: result.source_id,
    source_url: result.source_url,
    source_data: p,
    state: set?.preparation === 'prepared' ? 'cooked' : 'packaged',
  };
}
