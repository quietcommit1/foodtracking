import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Plus,
  ScanLine,
  Sunrise,
  Sun,
  Moon,
  Coffee,
  Pencil,
  Trash2,
  Copy,
  Bookmark,
  Utensils,
} from 'lucide-react';
import { useState, useRef } from 'react';
import { useStore, base, op } from '../store';
import { fmt, knownTotal, localDate, offsetDate, targetAt } from '../nutrition';
import { meals, type Entry, type Meal, type Nutrient } from '../types';
import Modal from './Modal';
export function Progress({
  label,
  k,
  consumed,
  target,
  incomplete,
}: {
  label: string;
  k: Nutrient;
  consumed: number;
  target: number | null;
  incomplete: boolean;
}) {
  const pct = target !== null && target > 0 ? Math.min(100, (consumed / target) * 100) : null;
  return (
    <div className={`macro ${k}`}>
      <div className="macro-top">
        <span className="macro-dot" />
        <span>{label}</span>
        <span className="unit">g</span>
      </div>
      <div className="macro-value">
        <strong>{fmt(consumed)}</strong>
        <span> / {target === null ? '—' : fmt(target)}</span>
      </div>
      <div
        className="bar"
        role="img"
        aria-label={`${label}: ${fmt(consumed)} grams consumed, ${target === null ? 'target unset' : `${fmt(target)} grams target`}${incomplete ? ', incomplete total' : ''}`}
      >
        <div style={{ width: `${pct ?? 0}%` }} />
      </div>
      <p>
        {incomplete ? 'Incomplete · ' : ''}
        {target === null
          ? 'Set target'
          : consumed > target
            ? `Over by ${fmt(consumed - target)} g`
            : `${fmt(target - consumed)} g remaining`}
      </p>
    </div>
  );
}
export default function Dashboard({
  date,
  setDate,
  onAdd,
  onScan,
  lookupPending = false,
  onEdit,
  onSettings,
}: {
  date: string;
  setDate: (d: string) => void;
  onAdd: (meal?: Meal) => void;
  onScan: () => void;
  lookupPending?: boolean;
  onEdit: (entry: Entry) => void;
  onSettings: () => void;
}) {
  const { data, queue, mutate, owner } = useStore();
  const entries = data.diary_entries.filter((e) => e.date === date);
  const target = targetAt(data.nutrition_targets, date);
  const calories = knownTotal(
    entries.map((e) => e.nutrition),
    'calories',
  );
  const ratio =
    target.calories && target.calories > 0 ? Math.min(1, calories.value / target.calories) : 0;
  const [copy, setCopy] = useState<Meal | null>(null);
  const [destination, setDestination] = useState(localDate());
  const [saveMeal, setSaveMeal] = useState<Meal | null>(null);
  const [mealName, setMealName] = useState('');
  const [deleteEntry, setDeleteEntry] = useState<Entry | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const actionPending = useRef(false);
  const icons = [Sunrise, Sun, Moon, Coffee];
  const today = date === localDate();
  const nice = new Date(date + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  async function copyMeal() {
    if (!destination) {
      setActionError('Choose a destination date');
      return;
    }
    if (actionPending.current) return;
    actionPending.current = true;
    setActionBusy(true);
    try {
      await mutate(
        entries
          .filter((e) => e.meal === copy)
          .map((e) => op('diary_entries', { ...e, ...base(), date: destination })),
      );
      setCopy(null);
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      actionPending.current = false;
      setActionBusy(false);
    }
  }
  async function bookmark() {
    if (!mealName.trim()) {
      setActionError('Enter a meal name');
      return;
    }
    if (actionPending.current) return;
    actionPending.current = true;
    setActionBusy(true);
    try {
      const m = { ...base(), name: mealName.trim() };
      await mutate([
        op('saved_meals', m),
        ...entries
          .filter((e) => e.meal === saveMeal)
          .map((e) =>
            op('saved_meal_items', {
              ...base(),
              saved_meal_id: m.id,
              food_id: e.food_id,
              name: e.name,
              quantity: e.quantity,
              unit: e.unit,
              nutrition: e.nutrition,
              portion_snapshot: e.portion_snapshot,
            }),
          ),
      ]);
      setSaveMeal(null);
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      actionPending.current = false;
      setActionBusy(false);
    }
  }
  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">A LITTLE MORE MINDFUL, EVERY DAY</div>
          <h1>
            {today ? 'Today' : 'Your diary'}
            <span className="heading-leaf" aria-hidden="true">
              ✳
            </span>
          </h1>
          <p className="muted">Your day, one meal at a time.</p>
        </div>
        <div className="date-control">
          <button
            className="icon-button"
            aria-label="Previous day"
            onClick={() => setDate(offsetDate(date, -1))}
          >
            <ArrowLeft size={17} />
          </button>
          <label className="date-picker">
            <CalendarDays size={17} />
            <span>
              {new Date(date + 'T12:00').toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </span>
            <input
              aria-label="Select diary date"
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </label>
          <button
            className="icon-button"
            aria-label="Next day"
            onClick={() => setDate(offsetDate(date, 1))}
          >
            <ArrowRight size={17} />
          </button>
        </div>
      </section>
      {!today && (
        <button className="text-button" onClick={() => setDate(localDate())}>
          Return to today
        </button>
      )}
      <div className="dashboard-grid">
        <div className="main-column">
          <section className="nutrition-panel">
            <div className="section-heading">
              <h2>Daily nutrition</h2>
              <button className="text-button" onClick={onSettings}>
                Edit targets <ArrowRight size={14} />
              </button>
            </div>
            <div className="calorie-summary">
              <div className="ring">
                <svg
                  viewBox="0 0 220 220"
                  role="img"
                  aria-label={`${fmt(calories.value)} calories consumed; ${target.calories === null ? 'target unset' : `${fmt(target.calories)} calorie target`}${calories.incomplete ? '; incomplete total' : ''}`}
                >
                  <circle cx="110" cy="110" r="92" className="ring-track" />
                  {ratio > 0 && (
                    <circle
                      cx="110"
                      cy="110"
                      r="92"
                      className="ring-fill"
                      strokeDasharray={`${ratio * 578} 578`}
                      transform="rotate(-90 110 110)"
                    />
                  )}
                </svg>
                <div className="ring-label">
                  <span>CONSUMED</span>
                  <strong>{fmt(calories.value)}</strong>
                  <small>kcal</small>
                </div>
              </div>
              <div className="calorie-details">
                <div className="pill">
                  <span /> {today ? 'TODAY’S BALANCE' : 'DAILY BALANCE'}
                </div>
                <h2>
                  {target.calories === null
                    ? 'Your daily picture'
                    : fmt(Math.abs(target.calories - calories.value))}
                  <span>
                    {target.calories === null
                      ? 'Set a target to see your balance'
                      : calories.value > target.calories
                        ? 'kcal over target'
                        : 'kcal remaining'}
                  </span>
                </h2>
                <div className="calorie-equation">
                  <span>
                    <strong>{fmt(calories.value)}</strong>Consumed
                  </span>
                  <span className="divider">/</span>
                  <span>
                    <strong>{target.calories === null ? 'Not set' : fmt(target.calories)}</strong>
                    Daily target
                  </span>
                </div>
                {calories.incomplete && (
                  <p className="warning">Incomplete: some entries have unknown calories.</p>
                )}
                <p className="small muted">Every meal counts. Make room for what you enjoy.</p>
              </div>
            </div>
            <div className="macro-grid">
              {(['protein', 'carbs', 'fat'] as const).map((k) => {
                const value = knownTotal(
                  entries.map((e) => e.nutrition),
                  k,
                );
                return (
                  <Progress
                    key={k}
                    label={k === 'carbs' ? 'Carbohydrates' : k === 'protein' ? 'Protein' : 'Fat'}
                    k={k}
                    consumed={value.value}
                    target={target[k]}
                    incomplete={value.incomplete}
                  />
                );
              })}
            </div>
          </section>
          <div className="logging-actions">
            <button className="primary" onClick={() => onAdd()}>
              <Plus size={21} />
              Add Food
            </button>
            <button className="secondary" disabled={lookupPending} onClick={onScan}>
              <ScanLine size={21} />
              Scan Barcode
            </button>
          </div>
          <div className="section-heading diary-heading">
            <h2>Your meals</h2>
            <span className="small muted">{nice}</span>
          </div>
          <section className="meals">
            {meals.map((meal, i) => {
              const Icon = icons[i];
              const list = entries.filter((e) => e.meal === meal);
              const c = knownTotal(
                list.map((e) => e.nutrition),
                'calories',
              );
              const protein = knownTotal(
                list.map((e) => e.nutrition),
                'protein',
              );
              return (
                <article className="meal-card" key={meal} aria-label={meal}>
                  <div className="meal-head">
                    <div className={`meal-icon meal-${i}`}>
                      <Icon size={20} />
                    </div>
                    <h3>
                      {meal}
                      <small>
                        {list.length
                          ? `${list.length} ${list.length === 1 ? 'entry' : 'entries'}`
                          : 'Nothing logged yet'}
                      </small>
                    </h3>
                    <div
                      className="meal-nutrients"
                      role="group"
                      aria-label={`${meal} nutrition totals`}
                    >
                      <strong className="meal-calories">
                        {fmt(c.value)} <small>kcal</small>
                      </strong>
                      <strong className="meal-protein">
                        {fmt(protein.value)} <small>g protein</small>
                      </strong>
                    </div>
                    <button
                      className="icon-button"
                      aria-label={`Add food to ${meal}`}
                      onClick={() => onAdd(meal)}
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                  {list.map((e) => (
                    <div className="diary-entry" key={e.id}>
                      <div className="entry-name">
                        <strong>{e.name}</strong>
                        <small>
                          {fmt(e.quantity)} {e.unit}
                          {queue.some((q) => q.table === 'diary_entries' && q.row.id === e.id) && (
                            <span className="pending"> · Unsynced</span>
                          )}
                        </small>
                      </div>
                      <div className="entry-nutrients">
                        <span>
                          {e.nutrition.calories === null
                            ? 'Calories unknown'
                            : `${fmt(e.nutrition.calories)} kcal`}
                        </span>
                        <span className="entry-protein">
                          {e.nutrition.protein === null
                            ? 'Protein unknown'
                            : `${fmt(e.nutrition.protein)} g protein`}
                        </span>
                      </div>
                      <div className="entry-actions">
                        <button
                          className="icon-button"
                          aria-label={`Edit ${e.name}`}
                          onClick={() => onEdit(e)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Delete ${e.name}`}
                          onClick={() => {
                            setActionError('');
                            setDeleteEntry(e);
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {(c.incomplete || protein.incomplete) && (
                    <p className="meal-incomplete">
                      {[c.incomplete ? 'Calorie' : '', protein.incomplete ? 'Protein' : '']
                        .filter(Boolean)
                        .join(' and ')}{' '}
                      total incomplete — some entries have unknown values.
                    </p>
                  )}
                  {list.length > 0 ? (
                    <div className="meal-footer">
                      <button
                        className="text-button"
                        onClick={() => {
                          setCopy(meal);
                          setActionError('');
                        }}
                      >
                        <Copy size={14} />
                        Copy meal
                      </button>
                      <button
                        className="text-button"
                        onClick={() => {
                          setSaveMeal(meal);
                          setMealName(meal);
                          setActionError('');
                        }}
                      >
                        <Bookmark size={14} />
                        Save meal
                      </button>
                    </div>
                  ) : (
                    <button className="empty-meal" onClick={() => onAdd(meal)}>
                      + Add your {meal.toLowerCase()}
                    </button>
                  )}
                </article>
              );
            })}
          </section>
          <div className="zero-day">
            <label>
              <input
                type="checkbox"
                checked={!!data.diary_days.find((d) => d.date === date)?.zero_intake}
                disabled={entries.length > 0 || !owner}
                onChange={(e) => {
                  const existing = data.diary_days.find((d) => d.date === date);
                  void mutate([
                    op('diary_days', {
                      ...(existing ?? base()),
                      date,
                      zero_intake: e.target.checked,
                    }),
                  ]).catch((e) => setActionError(e.message));
                }}
              />
              Explicitly record zero intake for this day
            </label>
            <small className="muted">
              Unchecked empty days are unlogged, and excluded from history averages.
            </small>
          </div>
          {actionError && !copy && !saveMeal && !deleteEntry && (
            <p role="alert" className="error">
              {actionError}
            </p>
          )}
        </div>
        <aside className="side-column">
          <div className="gentle-card">
            <div className="illustration">
              <div className="plate">
                <span className="rice" />
                <span className="greens" />
                <span className="tomato" />
                <span className="lentils" />
              </div>
              <span className="sprig">✳</span>
            </div>
            <div className="eyebrow">GOOD FOOD. YOUR WAY.</div>
            <h2>
              A little awareness.
              <br />A lot of possibility.
            </h2>
            <p>From your morning chai to homemade dal — give your everyday meals a place.</p>
          </div>
          <div className="quick-card">
            <h3>Your daily rhythm</h3>
            <div>
              <Utensils size={19} />
              <span>
                <strong>{entries.length} foods logged</strong>
                <small>Small steps, at your own pace</small>
              </span>
            </div>
            <p className="small muted">Your diary is private. Your targets are yours to set.</p>
          </div>
          <div className="source-note">
            Made for real life.
            <br />
            No exercise calories. No judgement.
          </div>
        </aside>
      </div>
      {copy && (
        <Modal title={`Copy ${copy}`} onClose={() => setCopy(null)}>
          <label>
            Destination date
            <input
              type="date"
              required
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </label>
          <p className="muted">
            Copies the stored nutrition snapshots and portions. Existing entries are kept.
          </p>
          {actionError && (
            <p role="alert" className="error">
              {actionError}
            </p>
          )}
          <button className="primary" disabled={actionBusy} onClick={() => void copyMeal()}>
            Copy meal
          </button>
        </Modal>
      )}
      {saveMeal && (
        <Modal title="Save a meal" onClose={() => setSaveMeal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void bookmark();
            }}
          >
            <label>
              Meal name
              <input
                required
                maxLength={200}
                value={mealName}
                onChange={(e) => setMealName(e.target.value)}
              />
            </label>
            {actionError && (
              <p role="alert" className="error">
                {actionError}
              </p>
            )}
            <button className="primary" disabled={actionBusy}>
              Save for next time
            </button>
          </form>
        </Modal>
      )}
      {deleteEntry && (
        <Modal title="Delete this entry?" onClose={() => setDeleteEntry(null)}>
          <p>{deleteEntry.name} will be removed from this diary.</p>
          {actionError && (
            <p role="alert" className="error">
              {actionError}
            </p>
          )}
          <button
            className="danger"
            disabled={actionBusy}
            onClick={async () => {
              if (actionPending.current) return;
              actionPending.current = true;
              setActionBusy(true);
              try {
                await mutate([op('diary_entries', deleteEntry, 'delete')]);
                setDeleteEntry(null);
              } catch (e) {
                setActionError((e as Error).message);
              } finally {
                actionPending.current = false;
                setActionBusy(false);
              }
            }}
          >
            Delete entry
          </button>
        </Modal>
      )}
    </>
  );
}
