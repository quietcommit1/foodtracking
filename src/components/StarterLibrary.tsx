import { useEffect, useState, useMemo, useDeferredValue } from 'react';
import {
  catalog,
  catalogSourceId,
  searchCatalog,
  loadReferenceCatalog,
  type CatalogFood,
} from '../catalog';
import { fmt } from '../nutrition';
import type { Food } from '../types';
export default function StarterLibrary({
  search,
  saved,
  onChoose,
  compact = false,
}: {
  compact?: boolean;
  search: string;
  saved: Food[];
  onChoose: (food: CatalogFood) => void;
}) {
  const [limit, setLimit] = useState(12);
  const [reference, setReference] = useState<CatalogFood[]>([]);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
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
            'Reference library could not load. Reconnect and retry. Starter foods remain available.',
          );
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => setLimit(12), [search]);
  const query = useDeferredValue(search);
  const foods = useMemo(() => [...catalog, ...reference], [reference]);
  const savedIds = useMemo(() => new Set(saved.map((f) => f.source_id)), [saved]);
  const matches = useMemo(
    () => searchCatalog(query, foods).filter((item) => !savedIds.has(catalogSourceId(item.id))),
    [query, foods, savedIds],
  );
  const shown = matches.slice(0, limit);
  return (
    <section
      className={`starter-library${compact ? ' compact' : ''}`}
      aria-label="Reference food library"
    >
      <h2>Food reference library</h2>
      <p className="muted small">
        {catalog.length + reference.length} searchable foods · USDA SR28 historical reference data
        plus labelled Indian starter estimates. All values are per 100 g. Match the preparation and
        review before saving. Use recipes for homemade dishes including oil.
      </p>
      {!reference.length && !error && (
        <p role="status" className="muted">
          Loading USDA reference foods…
        </p>
      )}
      {error && (
        <p role="alert">
          {error}{' '}
          <button type="button" className="text-button" onClick={() => setAttempt(attempt + 1)}>
            Retry library
          </button>
        </p>
      )}
      {query !== search && (
        <p role="status" className="small muted">
          Updating results…
        </p>
      )}
      <div className="food-picker" aria-busy={query !== search || (!reference.length && !error)}>
        {shown.map((food) => (
          <button type="button" key={food.id} onClick={() => onChoose(food)}>
            <span>
              {food.name}
              <small>
                {food.kind === 'usda' ? 'USDA SR28' : 'Estimate'} · {fmt(food.nutrition.calories)}{' '}
                kcal / 100 g
              </small>
              <small>
                Protein {fmt(food.nutrition.protein)} g · Carbs {fmt(food.nutrition.carbs)} g · Fat{' '}
                {fmt(food.nutrition.fat)} g
              </small>
            </span>
            <span className="small">Review</span>
          </button>
        ))}
      </div>
      {!matches.length && reference.length > 0 && query === search && (
        <p className="muted">
          No reference matches. Try another name, scan a package or create a custom food.
        </p>
      )}
      {matches.length > shown.length && (
        <button type="button" className="secondary" onClick={() => setLimit(limit + 12)}>
          Show more foods ({matches.length - shown.length} more)
        </button>
      )}
    </section>
  );
}
