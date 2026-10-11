import { useState, useRef } from 'react';
import { Trash2, Plus } from 'lucide-react';
import Modal from './Modal';
import { base, op, useStore } from '../store';
import { fmt, makeSnapshot, recipeNutrition } from '../nutrition';
import { type Ingredient, type Recipe, type Food } from '../types';
export default function RecipeForm({ recipe, onClose }: { recipe?: Recipe; onClose: () => void }) {
  const { data, mutate } = useStore();
  const [name, setName] = useState(recipe?.name ?? '');
  const [servings, setServings] = useState(String(recipe?.servings ?? 4));
  const [weight, setWeight] = useState(String(recipe?.cooked_weight ?? ''));
  const [notes, setNotes] = useState(recipe?.notes ?? '');
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    data.recipe_ingredients.filter((i) => i.recipe_id === recipe?.id),
  );
  const [food, setFood] = useState('');
  const [quantity, setQuantity] = useState('100');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  let nutrition: ReturnType<typeof recipeNutrition> | undefined;
  try {
    nutrition = recipeNutrition(
      ingredients.map((i) => i.nutrition),
      Number(servings),
      weight ? Number(weight) : null,
    );
  } catch {}
  function add() {
    try {
      const f = data.foods.find((x) => x.id === food);
      if (!f) throw Error('Choose an ingredient');
      const snap = makeSnapshot(f, Number(quantity), f.basis);
      setIngredients([
        ...ingredients,
        {
          ...base(),
          recipe_id: recipe?.id ?? '',
          food_id: f.id,
          name: f.name,
          quantity: snap.quantity,
          unit: snap.unit,
          nutrition: snap.nutrition,
        },
      ]);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function save() {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    try {
      if (!name.trim() || !ingredients.length || !nutrition)
        throw Error('Add a name, ingredients and a positive yield');
      const r: Recipe = {
        ...(recipe ?? base()),
        name,
        servings: Number(servings),
        cooked_weight: weight ? Number(weight) : null,
        notes,
      };
      const previous = data.recipe_ingredients.filter((i) => i.recipe_id === r.id);
      const ops = [
        op('recipes', r),
        ...previous
          .filter((i) => !ingredients.some((x) => x.id === i.id))
          .map((i) => op('recipe_ingredients', i, 'delete')),
        ...ingredients.map((i) => op('recipe_ingredients', { ...i, recipe_id: r.id })),
      ];
      const existing = data.foods.find((f) => f.recipe_id === r.id);
      const f: Food = {
        ...(existing ?? base()),
        name,
        brand: 'Homemade recipe',
        barcode: null,
        basis: r.cooked_weight ? 'g' : 'serving',
        basis_amount: r.cooked_weight ? 100 : 1,
        serving_size: r.cooked_weight ? r.cooked_weight / r.servings : null,
        serving_unit: 'g',
        nutrition: nutrition.per100g ?? nutrition.perServing,
        notes,
        source: 'recipe',
        source_id: null,
        source_url: null,
        source_data: null,
        recipe_id: r.id,
        state: 'cooked',
      };
      ops.push(op('foods', f));
      await mutate(ops);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }
  return (
    <Modal title={recipe ? 'Edit recipe' : 'Create a homemade recipe'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <p className="muted">
          Build your own dal, sabzi, poha, or any everyday dish. Remember oil, ghee and sauces.
        </p>
        <label>
          Recipe name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My everyday moong dal"
          />
        </label>
        <div className="form-grid">
          <label>
            Number of servings
            <input
              type="number"
              min="0.01"
              step="any"
              required
              value={servings}
              onChange={(e) => setServings(e.target.value)}
            />
          </label>
          <label>
            Final cooked weight (g, optional)
            <input
              type="number"
              min="0.01"
              step="any"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </label>
        </div>
        <label>
          Ingredient from your foods
          <select
            value={food}
            onChange={(e) => {
              setFood(e.target.value);
              const f = data.foods.find((f) => f.id === e.target.value);
              setQuantity(f?.basis === 'serving' ? '1' : '100');
            }}
          >
            <option value="">Choose an ingredient</option>
            {data.foods
              .filter((f) => f.source !== 'recipe')
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.state}) · {f.basis}
                </option>
              ))}
          </select>
        </label>
        <div className="inline">
          <label>
            Quantity in {data.foods.find((f) => f.id === food)?.basis ?? 'basis units'}
            <input
              type="number"
              min="0.01"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <button type="button" className="secondary" onClick={add}>
            <Plus size={18} />
            Add
          </button>
        </div>
        {ingredients.map((i) => (
          <div className="ingredient" key={i.id}>
            <span>
              {i.name}
              <small>
                {i.quantity} {i.unit} · {fmt(i.nutrition.calories)} kcal
              </small>
            </span>
            <button
              type="button"
              aria-label={`Remove ${i.name}`}
              className="icon-button"
              onClick={() => setIngredients(ingredients.filter((x) => x.id !== i.id))}
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
        {nutrition && (
          <div className="notice">
            <strong>Batch: {fmt(nutrition.batch.calories)} kcal</strong>
            <p>
              Per serving: {fmt(nutrition.perServing.calories)} kcal ·{' '}
              {fmt(nutrition.perServing.protein)} g protein
            </p>
            {nutrition.per100g && <p>Per 100 g cooked: {fmt(nutrition.per100g.calories)} kcal</p>}
            <small>Unknown ingredient nutrients remain unknown in totals.</small>
          </div>
        )}
        <label>
          Preparation notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button type="submit" className="primary wide" disabled={saving}>
          {saving ? 'Saving…' : 'Save recipe & logging food'}
        </button>
      </form>
    </Modal>
  );
}
