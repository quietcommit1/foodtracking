export const nutrientKeys = ['calories', 'protein', 'carbs', 'fat', 'fibre'] as const;
export type Nutrient = (typeof nutrientKeys)[number];
export type Nutrition = Record<Nutrient, number | null>;
export type Meal = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks';
export const meals: Meal[] = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
export type Base = { id: string; user_id: string; updated_at?: string };
export type Food = Base & {
  name: string;
  brand: string;
  barcode: string | null;
  basis: 'g' | 'ml' | 'serving';
  basis_amount: number;
  serving_size: number | null;
  serving_unit?: 'g' | 'ml' | null;
  nutrition: Nutrition;
  notes: string;
  source: 'manual' | 'openfoodfacts' | 'recipe';
  source_id: string | null;
  source_url: string | null;
  source_data: unknown;
  recipe_id?: string | null;
  state: 'raw' | 'cooked' | 'packaged';
};
export type Portion = Base & {
  food_id: string;
  name: string;
  quantity: number;
  unit: 'g' | 'ml' | 'serving';
};
export type Entry = Base & {
  date: string;
  meal: Meal;
  food_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  nutrition: Nutrition;
  portion_snapshot: unknown;
};
export type Target = Base & { effective_date: string; nutrition: Nutrition };
export type Recipe = Base & {
  name: string;
  servings: number;
  cooked_weight: number | null;
  notes: string;
};
export type Ingredient = Base & {
  recipe_id: string;
  food_id: string;
  quantity: number;
  unit: string;
  name: string;
  nutrition: Nutrition;
};
export type Favourite = Base & { food_id: string };
export type SavedMeal = Base & { name: string };
export type SavedItem = Base & {
  saved_meal_id: string;
  name: string;
  quantity: number;
  unit: string;
  nutrition: Nutrition;
  portion_snapshot: unknown;
  food_id: string | null;
};
export type Profile = Base & {
  theme: 'light' | 'dark' | 'system';
  last_meal: Meal;
  last_portions: Record<string, { quantity: number; unit: string }>;
};
export type Day = Base & { date: string; zero_intake: boolean };
export type Data = {
  foods: Food[];
  food_portions: Portion[];
  diary_entries: Entry[];
  nutrition_targets: Target[];
  recipes: Recipe[];
  recipe_ingredients: Ingredient[];
  favourites: Favourite[];
  saved_meals: SavedMeal[];
  saved_meal_items: SavedItem[];
  profiles: Profile[];
  diary_days: Day[];
};
export const tables = [
  'foods',
  'food_portions',
  'recipes',
  'recipe_ingredients',
  'diary_entries',
  'nutrition_targets',
  'favourites',
  'saved_meals',
  'saved_meal_items',
  'profiles',
  'diary_days',
] as const;
export type Table = (typeof tables)[number];
export const emptyData = (): Data =>
  Object.fromEntries(tables.map((t) => [t, []])) as unknown as Data;
export type Operation = { id: string; table: Table; action: 'upsert' | 'delete'; row: any };
