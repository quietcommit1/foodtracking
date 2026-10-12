import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import Modal from './Modal';
import FoodPicker from './FoodPicker';
import { base, op, useStore } from '../store';
import { fmt, makeSnapshot, scale, total, unknown } from '../nutrition';
import { meals, type Food, type Meal, type Entry } from '../types';
export default function AddFood({
  date,
  onClose,
  onCreate,
  initialFood,
  initialMeal,
  entry,
}: {
  date: string;
  onClose: () => void;
  onCreate: (context: { date: string; meal: Meal }) => void;
  initialFood?: Food;
  initialMeal?: Meal;
  entry?: Entry;
}) {
  const { data, mutate } = useStore();
  const profile = data.profiles[0];
  const [search, setSearch] = useState('');
  const [showMeals, setShowMeals] = useState(false);
  const [selected, setSelected] = useState<Food | undefined>(initialFood);
  const savedPortion = initialFood ? profile?.last_portions[initialFood.id] : null;
  const [quantity, setQuantity] = useState(
    String(
      entry?.quantity ?? savedPortion?.quantity ?? (initialFood?.basis === 'serving' ? 1 : 100),
    ),
  );
  const [unit, setUnit] = useState(entry?.unit ?? savedPortion?.unit ?? initialFood?.basis ?? 'g');
  const [meal, setMeal] = useState<Meal>(
    entry?.meal ?? initialMeal ?? profile?.last_meal ?? 'Breakfast',
  );
  const [day, setDay] = useState(entry?.date ?? date);
  const [error, setError] = useState('');
  const [quick, setQuick] = useState(!!(entry?.portion_snapshot as any)?.quick);
  const [name, setName] = useState(entry?.name ?? 'Quick entry');
  const [calories, setCalories] = useState(
    entry?.nutrition.calories === null ? '' : String(entry?.nutrition.calories ?? ''),
  );
  const [saved, setSaved] = useState('');
  const [mealFactor, setMealFactor] = useState('1');
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const focusQuantity = useRef(
    navigator.maxTouchPoints === 0 && !matchMedia('(pointer: coarse)').matches,
  );
  const quantityInput = useRef<HTMLInputElement>(null);
  const original = useRef(JSON.stringify({ quantity, unit, meal, day, name, calories }));
  const factorPreview =
    Number.isFinite(Number(mealFactor)) && Number(mealFactor) > 0 ? Number(mealFactor) : 0;
  const savedPreview = total(
    data.saved_meal_items
      .filter((item) => item.saved_meal_id === saved)
      .map((item) => scale(item.nutrition, factorPreview)),
  );
  useEffect(() => {
    if (selected) {
      quantityInput.current?.closest('dialog')?.scrollTo({ top: 0, behavior: 'auto' });
      if (focusQuantity.current) quantityInput.current?.focus({ preventScroll: true });
      else
        (quantityInput.current?.closest('.portion-box') as HTMLElement | null)?.focus({
          preventScroll: true,
        });
    }
  }, [selected?.id]);
  let preview;
  try {
    if (selected) preview = makeSnapshot(selected, Number(quantity), unit).nutrition;
    else if (entry && !quick && Number(quantity) > 0)
      preview = scale(entry.nutrition, Number(quantity) / entry.quantity);
  } catch {
    /* validation stays in the form */
  }

  function select(f: Food, keyboardSelection = false) {
    focusQuantity.current =
      keyboardSelection ||
      (navigator.maxTouchPoints === 0 && !matchMedia('(pointer: coarse)').matches);
    setSelected(f);
    const p = profile?.last_portions[f.id];
    setQuantity(String(p?.quantity ?? (f.basis === 'serving' ? 1 : 100)));
    setUnit(p?.unit ?? f.basis);
    setQuick(false);
    setError('');
  }
  async function submit() {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    try {
      if (!day) throw Error('Choose a date');
      if (saved) {
        const factor = Number(mealFactor);
        if (!(factor > 0) || !Number.isFinite(factor))
          throw Error('Enter a positive meal multiplier');
        const items = data.saved_meal_items.filter((x) => x.saved_meal_id === saved);
        if (!items.length) throw Error('This meal has no items');
        const zeroDay = data.diary_days.find((d) => d.date === day && d.zero_intake);
        const mealOps = items.map((x) =>
          op('diary_entries', {
            ...base(),
            date: day,
            meal,
            food_id: x.food_id,
            name: x.name,
            quantity: x.quantity * factor,
            unit: x.unit,
            nutrition: scale(x.nutrition, factor),
            portion_snapshot: x.portion_snapshot,
          }),
        );
        if (zeroDay) mealOps.push(op('diary_days', { ...zeroDay, zero_intake: false }));
        await mutate(mealOps);
        onClose();
        return;
      }
      let snapshot;
      if (quick) {
        if (!name.trim() || calories === '' || Number(calories) < 0)
          throw Error('Enter a name and non-negative calories');
        snapshot = {
          food_id: entry?.food_id ?? null,
          name,
          quantity: 1,
          unit: 'entry',
          nutrition: { ...unknown(), calories: Number(calories) },
          portion_snapshot: entry?.portion_snapshot ?? { quick: true },
        };
      } else if (selected && !entry) {
        snapshot = makeSnapshot(selected, Number(quantity), unit);
      } else if (entry) {
        if (!(Number(quantity) > 0)) throw Error('Quantity must be positive');
        snapshot = {
          food_id: entry.food_id,
          name: entry.name,
          quantity: Number(quantity),
          unit: entry.unit,
          nutrition: scale(entry.nutrition, Number(quantity) / entry.quantity),
          portion_snapshot: entry.portion_snapshot,
        };
      } else throw Error('Choose a food');
      const zeroDay = data.diary_days.find((d) => d.date === day && d.zero_intake);
      const ops = [op('diary_entries', { ...(entry ?? base()), ...snapshot, date: day, meal })];
      if (zeroDay) ops.push(op('diary_days', { ...zeroDay, zero_intake: false }));
      if (selected) {
        if (!data.foods.some((food) => food.id === selected.id)) ops.unshift(op('foods', selected));
        ops.push(
          op('profiles', {
            ...(profile ?? { ...base(), theme: 'system', last_portions: {} }),
            last_meal: meal,
            last_portions: {
              ...profile?.last_portions,
              [selected.id]: { quantity: Number(quantity), unit },
            },
          }),
        );
      }
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
    <Modal
      title={entry ? 'Edit diary entry' : 'Add to your diary'}
      onClose={onClose}
      dirty={JSON.stringify({ quantity, unit, meal, day, name, calories }) !== original.current}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="form-grid">
          <label>
            Date
            <input type="date" required value={day} onChange={(e) => setDay(e.target.value)} />
          </label>
          <label>
            Meal
            <select
              aria-label="Meal"
              value={meal}
              onChange={(e) => setMeal(e.target.value as Meal)}
            >
              {meals.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
        </div>
        {!entry && !selected && !quick && !saved && (
          <>
            <div className="search">
              <Search size={18} />
              <input
                aria-label="Search foods"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                }}
                placeholder="Search foods, brands or barcodes…"
              />
            </div>
            <div className="button-row">
              <button
                type="button"
                className="text-button"
                aria-expanded={showMeals}
                onClick={() => setShowMeals(!showMeals)}
              >
                Saved meals
              </button>
              <button
                type="button"
                className={quick ? 'selected' : ''}
                onClick={() => {
                  setQuick(true);
                  setSelected(undefined);
                  setSaved('');
                }}
              >
                Quick calories
              </button>
            </div>
            {showMeals && data.saved_meals.length === 0 && (
              <p className="muted">
                Use Save meal under a logged meal in your diary to reuse it here.
              </p>
            )}
            {showMeals && data.saved_meals.length > 0 && (
              <label>
                Saved meal
                <select
                  aria-label="Saved meal"
                  value={saved}
                  onChange={(e) => {
                    setSaved(e.target.value);
                    setSelected(undefined);
                    setQuick(false);
                  }}
                >
                  <option value="">Choose a saved meal</option>
                  {data.saved_meals.map((m) => (
                    <option value={m.id} key={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <FoodPicker
              search={search}
              saved={data.foods}
              entries={data.diary_entries}
              onChoose={(food, keyboardSelection) => {
                select(food, keyboardSelection);
                setSaved('');
              }}
            />
            <button
              type="button"
              className="text-button"
              onClick={() => onCreate({ date: day, meal })}
            >
              + Create a custom food
            </button>
          </>
        )}
        {!entry && (selected || quick || saved) && (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setSelected(undefined);
              setQuick(false);
              setSaved('');
              setError('');
            }}
          >
            ← Change food
          </button>
        )}
        {saved && (
          <div className="portion-box" tabIndex={-1}>
            <strong>{data.saved_meals.find((item) => item.id === saved)?.name}</strong>
            <p className="small muted">
              Adds the saved meal's original portions and nutrition to your diary.
            </p>
            <label>
              Meal multiplier
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="any"
                value={mealFactor}
                onChange={(e) => setMealFactor(e.target.value)}
              />
            </label>
            {data.saved_meal_items
              .filter((item) => item.saved_meal_id === saved)
              .map((item) => (
                <p key={item.id}>
                  {item.name} · {fmt(item.quantity * factorPreview)} {item.unit} ·{' '}
                  {fmt(scale(item.nutrition, factorPreview).calories)} kcal
                </p>
              ))}
            <div
              className="portion-preview"
              role="group"
              aria-label="Saved meal nutrition"
              aria-live="polite"
            >
              <span>{fmt(savedPreview.calories)} kcal</span>
              <span>{fmt(savedPreview.protein)} g protein</span>
              <span>{fmt(savedPreview.carbs)} g carbs</span>
              <span>{fmt(savedPreview.fat)} g fat</span>
            </div>
            <p className="small muted">
              Unknown values keep totals incomplete. The multiplier scales every saved portion.
            </p>
          </div>
        )}
        {quick ? (
          <>
            <label>
              Entry name
              <input required value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              Calories (kcal)
              <input
                required
                type="number"
                min="0"
                step="any"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
              />
            </label>
            <p className="muted">
              Macros remain unknown. Your macro totals will be marked incomplete.
            </p>
          </>
        ) : (
          (selected || entry) && (
            <div className="portion-box" tabIndex={-1}>
              <strong>{selected?.name ?? entry?.name}</strong>
              {selected?.source_id?.startsWith('everyday-starter-v1:') && (
                <p className="small muted">
                  Starter estimate — review against your package or recipe.
                </p>
              )}
              {selected?.source_id?.startsWith('usda-sr28:') && (
                <p className="small muted">
                  USDA historical reference — match the exact preparation.
                </p>
              )}
              {selected && (
                <p className="small">
                  Per {selected.basis_amount} {selected.basis}: {fmt(selected.nutrition.calories)}{' '}
                  kcal · Protein {fmt(selected.nutrition.protein)} g · Carbs{' '}
                  {fmt(selected.nutrition.carbs)} g · Fat {fmt(selected.nutrition.fat)} g
                </p>
              )}
              <div className="form-grid">
                <label>
                  Quantity
                  <input
                    ref={quantityInput}
                    inputMode="decimal"
                    required
                    type="number"
                    min="0.01"
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </label>
                <label>
                  Unit
                  <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                    {selected ? (
                      <>
                        <option value={selected.basis}>{selected.basis}</option>
                        {selected.basis === 'serving' &&
                          selected.serving_size &&
                          selected.serving_unit && (
                            <option value={selected.serving_unit}>
                              {selected.serving_unit} ({selected.serving_size} per serving)
                            </option>
                          )}
                        {selected.basis !== 'serving' && selected.serving_size && (
                          <option value="serving">
                            serving ({selected.serving_size} {selected.basis})
                          </option>
                        )}
                      </>
                    ) : (
                      <option>{entry?.unit}</option>
                    )}
                  </select>
                </label>
              </div>
              {preview && (
                <div
                  className="portion-preview"
                  role="group"
                  aria-live="polite"
                  aria-label="Nutrition for this portion"
                >
                  <span>
                    <strong>{fmt(preview.calories)}</strong> kcal
                  </span>
                  <span>
                    <strong>{fmt(preview.protein)}</strong> g protein
                  </span>
                  <span>
                    <strong>{fmt(preview.carbs)}</strong> g carbs
                  </span>
                  <span>
                    <strong>{fmt(preview.fat)}</strong> g fat
                  </span>
                </div>
              )}
              {selected?.source_id &&
                (selected.source_id.startsWith('everyday-starter-v1:') ||
                  selected.source_id.startsWith('usda-sr28:')) && (
                  <details>
                    <summary>Nutrition source and portion guidance</summary>
                    <p>
                      {selected.notes} Adding this food confirms the nutrition and saves a private
                      copy to your library.
                    </p>
                  </details>
                )}
              {selected &&
                data.food_portions
                  .filter((p) => p.food_id === selected.id)
                  .map((p) => (
                    <button
                      type="button"
                      className="chip"
                      key={p.id}
                      onClick={() => {
                        setQuantity(String(p.quantity));
                        setUnit(p.unit);
                      }}
                    >
                      {p.name} · {p.quantity} {p.unit}
                    </button>
                  ))}
              {selected && (
                <p className="small muted">
                  {selected.basis === 'serving'
                    ? 'Servings are defined for this food.'
                    : 'Only food-specific saved serving conversions are available.'}
                </p>
              )}
            </div>
          )
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {(entry || selected || quick || saved) && (
          <div className="dialog-actions">
            <button className="primary wide" type="submit" disabled={saving}>
              {saving ? 'Saving…' : entry ? 'Save entry' : 'Add food'}
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}
