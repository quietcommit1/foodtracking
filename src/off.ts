import { type Food, nutrientKeys } from './types';
import { unknown } from './nutrition';
export function externalFood(result: any, identity: { id: string; user_id: string }): Food {
  const p = result.product ?? {};
  const set = p.nutrition?.aggregated_set;
  const legacy = p.nutriments;
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
    const item = set?.nutrients?.[key];
    const raw = set ? (item?.modifier ? null : item?.value) : legacy?.[`${key}_100g`];
    nutrition[k] = typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : null;
  }
  const per = set?.per ?? '100g';
  const unit = per === '100ml' ? 'ml' : 'g';
  return {
    ...identity,
    name: p.product_name ?? '',
    brand: p.brands ?? '',
    barcode: result.barcode,
    basis: unit,
    basis_amount: 100,
    serving_size: null,
    serving_unit: unit,
    nutrition,
    notes: [
      p.serving_size
        ? `Source serving description: ${p.serving_size}. Confirm the serving weight or volume manually.`
        : '',
      set?.preparation === 'prepared'
        ? 'External nutrition is for the prepared product. Confirm preparation.'
        : '',
      !set && !legacy
        ? 'Source has no usable normalized nutrition. Enter values from the package.'
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
