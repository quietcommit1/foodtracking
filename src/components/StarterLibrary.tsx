import { useState } from 'react';
import { catalogSourceId, searchCatalog, type CatalogFood } from '../catalog';
import { fmt } from '../nutrition';
import type { Food } from '../types';
export default function StarterLibrary({
  search,
  saved,
  onChoose,
}: {
  search: string;
  saved: Food[];
  onChoose: (food: CatalogFood) => void;
}) {
  const [limit, setLimit] = useState(12);
  const matches = searchCatalog(search).filter(
    (item) => !saved.some((f) => f.source_id === catalogSourceId(item.id)),
  );
  const shown = search ? matches : matches.slice(0, limit);
  return (
    <section className="starter-library" aria-label="Starter food library">
      <h2>Starter food library</h2>
      <p className="muted small">
        Common foods with estimated macros per 100 g. Review before saving; these are not verified
        labels. Dry and cooked weights differ. For dal, sabzi and other dishes, build a recipe
        including oil.
      </p>
      <div className="food-picker">
        {shown.map((food) => (
          <button type="button" key={food.id} onClick={() => onChoose(food)}>
            <span>
              {food.name}
              <small>Estimate · {fmt(food.nutrition.calories)} kcal / 100 g</small>
              <small>
                Protein {fmt(food.nutrition.protein)} g · Carbs {fmt(food.nutrition.carbs)} g · Fat{' '}
                {fmt(food.nutrition.fat)} g
              </small>
            </span>
            <span className="small">Review</span>
          </button>
        ))}
      </div>
      {!matches.length && (
        <p className="muted">
          No starter matches. Try another name, scan a package or create a custom food.
        </p>
      )}
      {!search && matches.length > shown.length && (
        <button type="button" className="secondary" onClick={() => setLimit(limit + 12)}>
          Show more foods ({matches.length - shown.length} more)
        </button>
      )}
    </section>
  );
}
