import { useState } from 'react';
import { Search, Plus, Star } from 'lucide-react';
import Modal from './Modal';
import StarterLibrary from './StarterLibrary';
import { catalogDraft, matchesFood } from '../catalog';
import { base, op, useStore } from '../store';
import { fmt, makeSnapshot, scale, unknown } from '../nutrition';
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
  onCreate: () => void;
  initialFood?: Food;
  initialMeal?: Meal;
  entry?: Entry;
}) {
  const { data, mutate } = useStore();
  const profile = data.profiles[0];
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('recent');
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
  const favouriteIds = data.favourites.map((f) => f.food_id);
  const recentIds = [...data.diary_entries]
    .sort((a, b) => (b.updated_at ?? b.date).localeCompare(a.updated_at ?? a.date))
    .map((e) => e.food_id);
  let foods = data.foods.filter((f) => matchesFood(f, search));
  if (!search && tab === 'favourites') foods = foods.filter((f) => favouriteIds.includes(f.id));
  if (!search && tab === 'recent')
    foods.sort((a, b) => {
      const ai = recentIds.indexOf(a.id),
        bi = recentIds.indexOf(b.id);
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    });
  function select(f: Food) {
    setSelected(f);
    const p = profile?.last_portions[f.id];
    setQuantity(String(p?.quantity ?? (f.basis === 'serving' ? 1 : 100)));
    setUnit(p?.unit ?? f.basis);
    setQuick(false);
    setError('');
  }
  async function submit() {
    try {
      if (!day) throw Error('Choose a date');
      if (saved) {
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
            quantity: x.quantity,
            unit: x.unit,
            nutrition: x.nutrition,
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
    }
  }
  return (
    <Modal title={entry ? 'Edit diary entry' : 'Add to your diary'} onClose={onClose}>
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
            <select value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
              {meals.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
        </div>
        {!entry && (
          <>
            <div className="search">
              <Search size={18} />
              <input
                aria-label="Search saved foods"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your foods, brands…"
              />
            </div>
            <div className="chips">
              {['recent', 'favourites', 'all', 'library'].map((t) => (
                <button
                  type="button"
                  key={t}
                  className={tab === t ? 'selected' : ''}
                  onClick={() => setTab(t)}
                >
                  {t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
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
            {!quick && (
              <div className="food-picker">
                {foods.slice(0, 60).map((f) => (
                  <button
                    type="button"
                    key={f.id}
                    className={selected?.id === f.id ? 'chosen' : ''}
                    onClick={() => {
                      select(f);
                      setSaved('');
                    }}
                  >
                    <span>
                      {f.name}
                      <small>
                        {f.brand || f.state} · {fmt(f.nutrition.calories)} kcal / {f.basis_amount}{' '}
                        {f.basis}
                      </small>
                    </span>
                    {favouriteIds.includes(f.id) ? <Star size={17} /> : <Plus size={17} />}
                  </button>
                ))}
                {!foods.length && tab !== 'library' && (
                  <p className="muted">No saved foods yet. Add your own or scan a package.</p>
                )}
              </div>
            )}
            {!quick && (search || tab === 'library' || !foods.length) && (
              <StarterLibrary
                search={search}
                saved={data.foods}
                onChoose={(item) => {
                  select(catalogDraft(item, base()));
                  setSaved('');
                }}
              />
            )}
            <button type="button" className="text-button" onClick={onCreate}>
              + Create a custom food
            </button>
            {data.saved_meals.length > 0 && (
              <label>
                Or use a saved meal
                <select
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
          </>
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
            <div className="portion-box">
              <strong>{selected?.name ?? entry?.name}</strong>
              {selected?.source_id &&
                (selected.source_id.startsWith('everyday-starter-v1:') ||
                  selected.source_id.startsWith('usda-sr28:')) && (
                  <p className="notice">
                    {selected.notes} Adding this food confirms the nutrition and saves a private
                    copy to your library.
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
        <button className="primary wide" type="submit">
          {entry ? 'Save entry' : 'Add food'}
        </button>
      </form>
    </Modal>
  );
}
