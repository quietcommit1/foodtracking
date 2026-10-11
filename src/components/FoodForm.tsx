import { useState } from 'react';
import Modal from './Modal';
import { base, op, useStore } from '../store';
import { unknown, normalizeBarcode } from '../nutrition';
import { nutrientKeys, type Food } from '../types';
export default function FoodForm({
  food,
  barcode = '',
  notice = '',
  onClose,
  onSaved,
}: {
  food?: Food;
  barcode?: string;
  notice?: string;
  onClose: () => void;
  onSaved?: (f: Food) => void;
}) {
  const { data, mutate } = useStore();
  const [draft, setDraft] = useState<Food>(
    food ?? {
      ...base(),
      name: '',
      brand: '',
      barcode: barcode || null,
      basis: 'g',
      basis_amount: 100,
      serving_size: null,
      serving_unit: 'g',
      nutrition: unknown(),
      notes: '',
      source: 'manual',
      source_id: null,
      source_url: null,
      source_data: null,
      state: 'packaged',
    },
  );
  const [error, setError] = useState('');
  const [duplicate, setDuplicate] = useState<Food | null>(null);
  const [portion, setPortion] = useState({ name: '', quantity: '', unit: 'g' });
  function field(k: keyof Food, v: unknown) {
    setDraft({ ...draft, [k]: v });
  }
  async function save() {
    try {
      if (!draft.name.trim()) throw Error('Enter a product or food name');
      if (draft.basis_amount <= 0 || (draft.serving_size !== null && draft.serving_size <= 0))
        throw Error('Basis and serving size must be positive');
      if (
        nutrientKeys.some(
          (k) =>
            draft.nutrition[k] !== null &&
            (!Number.isFinite(draft.nutrition[k]) || draft.nutrition[k]! < 0),
        )
      )
        throw Error('Nutrition values must be non-negative');
      const normalized = draft.barcode ? normalizeBarcode(draft.barcode) : null;
      const existing = data.foods.find(
        (f) => f.barcode === normalized && f.id !== draft.id && normalized,
      );
      if (existing) {
        setDuplicate(existing);
        throw Error('This barcode is already saved. Edit the existing product instead.');
      }
      const f = {
        ...draft,
        name: draft.name.trim(),
        barcode: normalized,
        serving_unit: draft.basis === 'serving' ? (draft.serving_unit ?? 'g') : draft.basis,
      };
      const ops = [op('foods', f)];
      if (portion.name) {
        const q = Number(portion.quantity);
        if (q <= 0) throw Error('Enter a positive household portion quantity');
        if (
          portion.unit !== f.basis &&
          !(portion.unit === 'serving' && f.serving_size) &&
          !(f.basis === 'serving' && portion.unit === f.serving_unit && f.serving_size)
        )
          throw Error('A household measure must use this food’s basis unit or a defined serving');
        ops.push(
          op('food_portions', {
            ...base(),
            food_id: f.id,
            name: portion.name,
            quantity: q,
            unit: portion.unit,
          }),
        );
      }
      await mutate(ops);
      onSaved?.(f);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal title={food ? 'Edit food' : 'Add a food'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {notice && <p className="notice">{notice}</p>}
        {draft.source === 'openfoodfacts' && (
          <div className="notice">
            Review nutrition against the package before saving.{' '}
            <a href={draft.source_url!} target="_blank" rel="noreferrer">
              Open Food Facts source ↗
            </a>
            <p>Corrections stay private; the original source is retained.</p>
          </div>
        )}
        <label>
          Food or product name
          <input
            required
            maxLength={200}
            value={draft.name}
            onChange={(e) => field('name', e.target.value)}
            placeholder="e.g. Homemade dal, Amul paneer"
          />
        </label>
        <div className="form-grid">
          <label>
            Brand (optional)
            <input value={draft.brand} onChange={(e) => field('brand', e.target.value)} />
          </label>
          <label>
            Barcode (optional)
            <input
              inputMode="numeric"
              value={draft.barcode ?? ''}
              onChange={(e) => field('barcode', e.target.value || null)}
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Nutrition basis
            <select
              value={draft.basis}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  basis: e.target.value as Food['basis'],
                  basis_amount: e.target.value === 'serving' ? 1 : 100,
                })
              }
            >
              <option value="g">Per 100 g</option>
              <option value="ml">Per 100 ml</option>
              <option value="serving">Per serving</option>
            </select>
          </label>
          <label>
            Preparation
            <select value={draft.state} onChange={(e) => field('state', e.target.value)}>
              <option value="packaged">Packaged</option>
              <option value="raw">Raw</option>
              <option value="cooked">Cooked</option>
            </select>
          </label>
        </div>
        {draft.basis === 'serving' && (
          <label>
            Serving measurement
            <select
              value={draft.serving_unit ?? 'g'}
              onChange={(e) => field('serving_unit', e.target.value)}
            >
              <option value="g">Weight in grams</option>
              <option value="ml">Volume in millilitres</option>
            </select>
          </label>
        )}
        <label>
          Serving{' '}
          {draft.basis === 'ml' || (draft.basis === 'serving' && draft.serving_unit === 'ml')
            ? 'volume (ml)'
            : 'weight (g)'}{' '}
          (optional)
          <input
            type="number"
            min="0.01"
            step="any"
            value={draft.serving_size ?? ''}
            onChange={(e) =>
              field('serving_size', e.target.value === '' ? null : Number(e.target.value))
            }
          />
        </label>
        <p className="muted">
          Nutrition per {draft.basis_amount} {draft.basis}. Leave genuinely unknown values blank.
        </p>
        <div className="form-grid nutrients-form">
          {nutrientKeys.map((k) => (
            <label key={k}>
              {k === 'carbs' ? 'Carbohydrates' : k[0].toUpperCase() + k.slice(1)} (
              {k === 'calories' ? 'kcal' : 'g'})
              <input
                type="number"
                min="0"
                step="any"
                value={draft.nutrition[k] ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    nutrition: {
                      ...draft.nutrition,
                      [k]: e.target.value === '' ? null : Number(e.target.value),
                    },
                  })
                }
              />
            </label>
          ))}
        </div>
        <label>
          Notes
          <textarea
            value={draft.notes}
            onChange={(e) => field('notes', e.target.value)}
            placeholder="Package details, ingredients, or preparation"
          />
        </label>
        <details>
          <summary>Save a household measure</summary>
          <p className="muted">
            Define this food’s own weight or volume. There are no universal cup or roti sizes.
          </p>
          <label>
            Measure name
            <input
              value={portion.name}
              onChange={(e) => setPortion({ ...portion, name: e.target.value })}
              placeholder="1 bowl / 1 roti"
            />
          </label>
          <div className="form-grid">
            <label>
              Equivalent quantity
              <input
                type="number"
                min="0.01"
                step="any"
                value={portion.quantity}
                onChange={(e) => setPortion({ ...portion, quantity: e.target.value })}
              />
            </label>
            <label>
              Unit
              <select
                value={portion.unit}
                onChange={(e) => setPortion({ ...portion, unit: e.target.value })}
              >
                <option value="g">g</option>
                <option value="ml">ml</option>
                <option value="serving">serving</option>
              </select>
            </label>
          </div>
        </details>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {duplicate && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setDraft(duplicate);
              setDuplicate(null);
              setError('');
            }}
          >
            Edit {duplicate.name}
          </button>
        )}
        <button className="primary wide" type="submit">
          {food && data.foods.some((f) => f.id === food.id) ? 'Save changes' : 'Save to my foods'}
        </button>
        <p className="small muted">
          {draft.source === 'manual'
            ? 'User-entered nutrition • not independently verified'
            : 'Source data is preserved; nutrition overrides are private.'}
        </p>
      </form>
    </Modal>
  );
}
