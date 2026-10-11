import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  catalog,
  catalogDraft,
  catalogSourceId,
  loadReferenceCatalog,
  matchesFood,
  searchCatalog,
  type CatalogFood,
} from '../catalog';
import { base } from '../store';
import { fmt } from '../nutrition';
import type { Entry, Food } from '../types';

export default function FoodPicker({
  search,
  saved,
  entries,
  onChoose,
}: {
  search: string;
  saved: Food[];
  entries: Entry[];
  onChoose: (food: Food) => void;
}) {
  const [reference, setReference] = useState<CatalogFood[]>([]);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [limit, setLimit] = useState(20);
  const query = useDeferredValue(search);
  useEffect(() => {
    let active = true;
    setError('');
    loadReferenceCatalog()
      .then((foods) => {
        if (active) setReference(foods);
      })
      .catch(() => {
        if (active)
          setError(
            'More reference foods could not load. Saved foods and starter estimates remain available. Reconnect and retry.',
          );
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => setLimit(20), [search]);
  const results = useMemo(() => {
    const recent = new Map<string, number>();
    [...entries]
      .sort((a, b) => (b.updated_at ?? b.date).localeCompare(a.updated_at ?? a.date))
      .forEach((entry) => {
        if (entry.food_id && !recent.has(entry.food_id)) recent.set(entry.food_id, recent.size);
      });
    const privateFoods = saved
      .filter((food) => matchesFood(food, query))
      .sort(
        (a, b) =>
          (recent.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
            (recent.get(b.id) ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name),
      );
    const savedSources = new Set(saved.map((food) => food.source_id));
    const references = searchCatalog(query, [...catalog, ...reference]).filter(
      (food) => !savedSources.has(catalogSourceId(food.id)),
    );
    return [
      ...privateFoods.map((food) => ({
        id: food.id,
        name: food.name,
        nutrition: food.nutrition,
        description: `${food.brand || food.state} · ${fmt(food.nutrition.calories)} kcal / ${food.basis_amount} ${food.basis}`,
        food,
        reference: null,
      })),
      ...references.map((item) => ({
        id: catalogSourceId(item.id),
        name: item.name,
        nutrition: item.nutrition,
        description: `${item.kind === 'usda' ? 'USDA SR28' : 'Estimate'} · ${fmt(item.nutrition.calories)} kcal / 100 g`,
        food: null,
        reference: item,
      })),
    ];
  }, [saved, entries, reference, query]);
  const loading = !reference.length && !error;
  return (
    <>
      <p className="small muted">
        Recently used foods first. Reference values are labelled; match the preparation and package
        label.
      </p>
      {loading && (
        <p role="status" className="small muted">
          Loading more foods… You can select the foods below now.
        </p>
      )}
      {error && (
        <p role="alert" className="small">
          {error}{' '}
          <button type="button" className="text-button" onClick={() => setAttempt(attempt + 1)}>
            Retry foods
          </button>
        </p>
      )}
      {query !== search && (
        <p role="status" className="small muted">
          Updating results…
        </p>
      )}
      <div
        className="food-picker"
        role="group"
        aria-label="All foods"
        aria-busy={loading || query !== search}
      >
        {results.slice(0, limit).map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => onChoose(item.food ?? catalogDraft(item.reference!, base()))}
          >
            <span>
              {item.name}
              <small>{item.description}</small>
              <small>
                Protein {fmt(item.nutrition.protein)} g · Carbs {fmt(item.nutrition.carbs)} g · Fat{' '}
                {fmt(item.nutrition.fat)} g
              </small>
            </span>
            <Plus size={17} aria-hidden="true" />
          </button>
        ))}
        {!results.length && !loading && query === search && (
          <p className="muted">
            No foods match. Try another name, barcode, or create a custom food.
          </p>
        )}
        {results.length > limit && (
          <button type="button" className="text-button" onClick={() => setLimit(limit + 20)}>
            Show more foods ({results.length - limit} more)
          </button>
        )}
      </div>
    </>
  );
}
