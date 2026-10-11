import { useState } from 'react';
import { op, useStore } from '../store';
import type { SavedMeal } from '../types';

export default function SavedMealEditor({ meal }: { meal: SavedMeal }) {
  const { data, mutate } = useStore();
  const [name, setName] = useState(meal.name);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const items = data.saved_meal_items.filter((item) => item.saved_meal_id === meal.id);
  async function save(remove = false) {
    if (busy) return;
    if (
      remove &&
      !window.confirm(`Delete saved meal ${meal.name}? Logged diary entries will stay.`)
    )
      return;
    if (!remove && !name.trim()) {
      setError('Enter a meal name');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await mutate(
        remove
          ? [
              ...items.map((item) => op('saved_meal_items', item, 'delete')),
              op('saved_meals', meal, 'delete'),
            ]
          : [op('saved_meals', { ...meal, name: name.trim() })],
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="saved-meal-editor">
      <label>
        Saved meal name
        <input maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <p className="small muted">
        {items.map((item) => `${item.name} (${item.quantity} ${item.unit})`).join(' · ')}
      </p>
      <div className="button-row">
        <button
          type="button"
          className="secondary"
          disabled={busy || name.trim() === meal.name}
          onClick={() => void save()}
        >
          Rename meal
        </button>
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() => void save(true)}
        >
          Delete saved meal
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
