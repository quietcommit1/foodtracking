import type { Food, Nutrition } from './types';

export type CatalogFood = {
  id: string;
  name: string;
  aliases: string;
  state: Food['state'];
  nutrition: Nutrition;
};
// Rounded starter estimates, NOT verified package labels or authoritative reference data.
// All values are per 100 g of the specified food state. No household/volume conversions.
const rows: [string, string, string, Food['state'], number, number, number, number][] = [
  [
    'soya-chunks',
    'Soya chunks — dry',
    'soy chunks soybean nuggets meal maker nutri nuggets textured vegetable protein tvp सोया',
    'packaged',
    345,
    52,
    33,
    0.5,
  ],
  ['atta', 'Whole wheat atta — dry', 'wheat flour chapati roti आटा', 'raw', 340, 13, 72, 2.5],
  ['rice-dry', 'White rice — dry', 'chawal basmati चावल', 'raw', 365, 7.1, 80, 0.7],
  [
    'rice-cooked',
    'White rice — cooked, plain',
    'chawal basmati चावल',
    'cooked',
    130,
    2.7,
    28.2,
    0.3,
  ],
  ['brown-rice-dry', 'Brown rice — dry', 'chawal', 'raw', 370, 7.9, 77, 2.9],
  ['brown-rice-cooked', 'Brown rice — cooked, plain', 'chawal', 'cooked', 123, 2.7, 25.6, 1],
  ['oats', 'Rolled oats — dry', 'oatmeal porridge', 'raw', 379, 13.2, 67.7, 6.5],
  [
    'poha',
    'Poha — dry rice flakes',
    'aval chivda flattened rice beaten rice पोहा',
    'raw',
    350,
    7,
    77,
    1,
  ],
  ['suji', 'Suji / semolina — dry', 'rava sooji upma सूजी', 'raw', 360, 12.7, 72.8, 1.1],
  ['besan', 'Besan — dry chickpea flour', 'gram flour chana बेसन', 'raw', 387, 22.4, 57.8, 6.7],
  ['ragi', 'Ragi flour — dry', 'finger millet nachni mandua', 'raw', 336, 7.3, 72, 1.3],
  ['bajra', 'Bajra — dry', 'pearl millet', 'raw', 361, 11.6, 67.5, 5],
  ['jowar', 'Jowar — dry', 'sorghum', 'raw', 329, 10.6, 72.1, 3.5],
  ['quinoa', 'Quinoa — cooked, plain', 'grain', 'cooked', 120, 4.4, 21.3, 1.9],
  ['moong', 'Moong dal — dry', 'mung green gram मूंग दाल', 'raw', 347, 24, 63, 1.2],
  ['masoor', 'Masoor dal — dry', 'red lentils मसूर', 'raw', 352, 24.6, 63.4, 1.1],
  ['toor', 'Toor dal — dry', 'arhar tur pigeon pea तूर अरहर', 'raw', 343, 21.7, 62.8, 1.5],
  ['urad', 'Urad dal — dry', 'black gram उड़द', 'raw', 341, 25.2, 59, 1.6],
  ['chana-dal', 'Chana dal — dry', 'bengal gram split chickpeas चना', 'raw', 360, 22, 60, 5],
  [
    'chickpeas-dry',
    'Chickpeas / kabuli chana — dry',
    'chole garbanzo छोले',
    'raw',
    378,
    20.5,
    63,
    6,
  ],
  [
    'chickpeas-cooked',
    'Chickpeas — boiled, drained',
    'chana chole garbanzo छोले',
    'cooked',
    164,
    8.9,
    27.4,
    2.6,
  ],
  ['rajma-dry', 'Rajma — dry', 'kidney beans राजमा', 'raw', 333, 23.6, 60, 0.8],
  ['rajma-cooked', 'Rajma — boiled, drained', 'kidney beans राजमा', 'cooked', 127, 8.7, 22.8, 0.5],
  ['lentils-cooked', 'Lentils — boiled, plain', 'dal daal मसूर दाल', 'cooked', 116, 9, 20.1, 0.4],
  ['soybeans', 'Soybeans — dry', 'soya soybean', 'raw', 446, 36.5, 30.2, 19.9],
  ['paneer', 'Paneer — full fat, generic', 'cottage cheese पनीर', 'packaged', 300, 18, 3, 24],
  ['tofu', 'Tofu — firm, generic', 'soy bean curd soya', 'packaged', 144, 17.3, 2.8, 8.7],
  ['curd', 'Curd / dahi — plain whole milk', 'yogurt yoghurt दही', 'packaged', 61, 3.5, 4.7, 3.3],
  ['milk', 'Milk — whole cow milk, by weight', 'doodh दूध', 'packaged', 61, 3.2, 4.8, 3.3],
  ['egg', 'Egg — whole, boiled, edible part', 'anda अंडा', 'cooked', 155, 12.6, 1.1, 10.6],
  ['egg-white', 'Egg white — cooked', 'anda albumen', 'cooked', 52, 10.9, 0.7, 0.2],
  ['chicken-raw', 'Chicken breast — raw, skinless', 'murgh poultry', 'raw', 120, 22.5, 0, 2.6],
  [
    'chicken-cooked',
    'Chicken breast — cooked, skinless',
    'murgh poultry roasted',
    'cooked',
    165,
    31,
    0,
    3.6,
  ],
  ['fish', 'Fish — cooked, generic lean fish', 'machli मछली', 'cooked', 128, 26, 0, 2],
  ['potato', 'Potato — raw, edible part', 'aloo आलू', 'raw', 77, 2, 17.5, 0.1],
  ['potato-boiled', 'Potato — boiled, plain', 'aloo आलू', 'cooked', 87, 1.9, 20.1, 0.1],
  ['sweet-potato', 'Sweet potato — raw', 'shakarkandi', 'raw', 86, 1.6, 20.1, 0.1],
  ['onion', 'Onion — raw', 'pyaz प्याज', 'raw', 40, 1.1, 9.3, 0.1],
  ['tomato', 'Tomato — raw', 'tamatar टमाटर', 'raw', 18, 0.9, 3.9, 0.2],
  ['spinach', 'Spinach — raw', 'palak पालक', 'raw', 23, 2.9, 3.6, 0.4],
  ['cauliflower', 'Cauliflower — raw', 'gobi फूलगोभी', 'raw', 25, 1.9, 5, 0.3],
  ['cabbage', 'Cabbage — raw', 'patta gobi', 'raw', 25, 1.3, 5.8, 0.1],
  ['peas', 'Green peas — raw', 'matar मटर', 'raw', 81, 5.4, 14.5, 0.4],
  ['carrot', 'Carrot — raw', 'gajar गाजर', 'raw', 41, 0.9, 9.6, 0.2],
  ['bhindi', 'Okra / bhindi — raw', 'lady finger भिंडी', 'raw', 33, 1.9, 7.5, 0.2],
  ['lauki', 'Bottle gourd / lauki — raw', 'dudhi ghiya लौकी', 'raw', 14, 0.6, 3.4, 0],
  ['brinjal', 'Brinjal / aubergine — raw', 'eggplant baingan बैंगन', 'raw', 25, 1, 5.9, 0.2],
  ['cucumber', 'Cucumber — raw', 'kheera खीरा', 'raw', 15, 0.7, 3.6, 0.1],
  ['banana', 'Banana — peeled', 'kela केला', 'raw', 89, 1.1, 22.8, 0.3],
  ['apple', 'Apple — edible part', 'seb सेब', 'raw', 52, 0.3, 13.8, 0.2],
  ['orange', 'Orange — peeled', 'santra संतरा', 'raw', 47, 0.9, 11.8, 0.1],
  ['mango', 'Mango — peeled, without stone', 'aam आम', 'raw', 60, 0.8, 15, 0.4],
  ['papaya', 'Papaya — edible part', 'papita पपीता', 'raw', 43, 0.5, 10.8, 0.3],
  ['guava', 'Guava — edible part', 'amrood अमरूद', 'raw', 68, 2.6, 14.3, 1],
  ['watermelon', 'Watermelon — edible part', 'tarbooz तरबूज', 'raw', 30, 0.6, 7.6, 0.2],
  ['dates', 'Dates — dried, without stones', 'khajoor खजूर', 'raw', 282, 2.5, 75, 0.4],
  [
    'peanuts',
    'Peanuts — dry roasted, unsalted',
    'groundnuts moongfali मूंगफली',
    'cooked',
    587,
    24.4,
    21.3,
    49.7,
  ],
  ['almonds', 'Almonds — raw', 'badam बादाम', 'raw', 579, 21.2, 21.6, 49.9],
  ['cashews', 'Cashews — raw', 'kaju काजू', 'raw', 553, 18.2, 30.2, 43.9],
  ['walnuts', 'Walnuts — raw', 'akhrot अखरोट', 'raw', 654, 15.2, 13.7, 65.2],
  ['chia', 'Chia seeds — dry', 'seed', 'raw', 486, 16.5, 42.1, 30.7],
  ['flax', 'Flax seeds — dry', 'linseed alsi', 'raw', 534, 18.3, 28.9, 42.2],
  [
    'oil',
    'Vegetable oil — generic',
    'sunflower mustard groundnut olive cooking oil tel तेल',
    'packaged',
    884,
    0,
    0,
    100,
  ],
  ['ghee', 'Ghee — generic', 'clarified butter घी', 'packaged', 900, 0, 0, 100],
  ['butter', 'Butter — generic', 'makhan मक्खन', 'packaged', 717, 0.9, 0.1, 81.1],
  ['sugar', 'Sugar — white', 'chini चीनी', 'packaged', 387, 0, 100, 0],
  ['jaggery', 'Jaggery — generic', 'gur gud गुड़', 'packaged', 383, 0.4, 98, 0.1],
  ['honey', 'Honey — generic', 'shahad शहद', 'packaged', 304, 0.3, 82.4, 0],
];
export const catalog: CatalogFood[] = rows.map(
  ([id, name, aliases, state, calories, protein, carbs, fat]) => ({
    id,
    name,
    aliases,
    state,
    nutrition: { calories, protein, carbs, fat, fibre: null },
  }),
);
export const catalogNotice =
  'Starter estimate, not verified nutrition. Review against your package or recipe before saving. Values are per 100 g of the named raw/dry/cooked food, not per bowl or piece. Brand and cooking differences can be substantial. Fibre is unknown.';
export function searchCatalog(query: string): CatalogFood[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return catalog.filter((f) =>
    words.every((word) => `${f.name} ${f.aliases}`.toLocaleLowerCase().includes(word)),
  );
}
export function catalogSourceId(id: string) {
  return `everyday-starter-v1:${id}`;
}
export function catalogDraft(item: CatalogFood, identity: { id: string; user_id: string }): Food {
  return {
    ...identity,
    name: item.name,
    brand: '',
    barcode: null,
    basis: 'g',
    basis_amount: 100,
    serving_size: null,
    serving_unit: 'g',
    nutrition: { ...item.nutrition },
    notes: catalogNotice,
    source: 'manual',
    source_id: catalogSourceId(item.id),
    source_url: null,
    source_data: {
      kind: 'starter-estimate',
      version: 1,
      catalog_id: item.id,
      nutrition: { ...item.nutrition },
      notice: catalogNotice,
    },
    state: item.state,
  };
}

export function matchesFood(food: Food, query: string): boolean {
  const starter = catalog.find((item) => catalogSourceId(item.id) === food.source_id);
  const text =
    `${food.name} ${food.brand} ${food.barcode ?? ''} ${starter?.aliases ?? ''}`.toLocaleLowerCase();
  return query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word));
}
