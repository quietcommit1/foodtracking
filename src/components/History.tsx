import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useStore } from '../store';
import { historySummary, localDate, offsetDate, knownTotal, fmt } from '../nutrition';
export default function History({ onDate }: { onDate: (date: string) => void }) {
  const { data } = useStore();
  const [period, setPeriod] = useState(7);
  const [page, setPage] = useState(0);
  const summary = historySummary(data.diary_entries, data.diary_days, localDate(), period);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR EVERYDAY PICTURE</div>
          <h1>History</h1>
          <p className="muted">A little perspective on the meals behind you.</p>
        </div>
        <div className="chips">
          {[7, 30].map((n) => (
            <button
              key={n}
              aria-pressed={period === n}
              className={period === n ? 'selected' : ''}
              onClick={() => setPeriod(n)}
            >
              {n} days
            </button>
          ))}
        </div>
      </div>
      <div className="history-summary">
        {(['calories', 'protein', 'carbs', 'fat'] as const).map((k) => (
          <article className="surface" key={k}>
            <span className="muted">Average {k === 'carbs' ? 'carbohydrates' : k}</span>
            <h2>
              {summary.logged === 0 ? '—' : fmt(summary.average[k])}
              <small> {k === 'calories' ? 'kcal' : 'g'}/day</small>
            </h2>
          </article>
        ))}
      </div>
      <p className="muted">
        Averages include {summary.logged} logged or explicitly zero days; {summary.unlogged}{' '}
        unlogged days are excluded. If a nutrient is unknown on any included entry, its average is
        unknown.
      </p>
      <section className="surface">
        <h2>Daily intake</h2>
        <p className="small muted">
          Tap a date to open its diary. Swipe or scroll horizontally for more dates.
        </p>
        <div
          className="history-chart-scroll"
          tabIndex={0}
          role="region"
          aria-label="Daily calorie chart; scroll for more dates"
        >
          <div
            className="history-chart"
            role="group"
            aria-label={`Calorie intake for the last ${period} days; empty days are unlogged.`}
          >
            {Array.from({ length: period }, (_, i) =>
              offsetDate(localDate(), -(period - 1 - i)),
            ).map((date) => {
              const entries = data.diary_entries.filter((e) => e.date === date);
              const v = knownTotal(
                entries.map((e) => e.nutrition),
                'calories',
              );
              const max = Math.max(
                1,
                ...Array.from({ length: period }, (_, n) =>
                  data.diary_entries
                    .filter((e) => e.date === offsetDate(localDate(), -n))
                    .reduce((s, e) => s + (e.nutrition.calories ?? 0), 0),
                ),
              );
              const isLogged =
                entries.length > 0 || data.diary_days.some((d) => d.date === date && d.zero_intake);
              return (
                <button
                  key={date}
                  aria-label={`${date}: ${isLogged ? `${fmt(v.value)} calories${v.incomplete ? ', incomplete' : ''}` : 'unlogged'}`}
                  title={`${date}: ${isLogged ? fmt(v.value) + ' kcal' : 'Unlogged'}`}
                  onClick={() => onDate(date)}
                >
                  <span
                    className={isLogged ? 'logged' : 'unlogged'}
                    style={{ height: `${isLogged ? Math.max(3, (v.value / max) * 120) : 3}px` }}
                  />
                  <small>
                    {period === 7
                      ? new Date(date + 'T12:00').toLocaleDateString(undefined, {
                          weekday: 'short',
                        })
                      : date.slice(-2)}
                  </small>
                </button>
              );
            })}
          </div>
        </div>
      </section>
      <section className="surface history-list">
        <h2>Past diaries</h2>
        {Array.from({ length: 14 }, (_, i) => offsetDate(localDate(), -i - page * 14)).map(
          (date) => {
            const entries = data.diary_entries.filter((e) => e.date === date);
            const logged =
              entries.length || data.diary_days.some((d) => d.date === date && d.zero_intake);
            const c = knownTotal(
              entries.map((e) => e.nutrition),
              'calories',
            );
            return (
              <button key={date} onClick={() => onDate(date)}>
                <span>
                  {new Date(date + 'T12:00').toLocaleDateString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                  <small>
                    {entries.length} entries · {logged ? 'Recorded' : 'Unlogged'}
                  </small>
                </span>
                <strong>{logged ? `${fmt(c.value)}${c.incomplete ? '*' : ''} kcal` : '—'}</strong>
                <ArrowUpRight size={18} />
              </button>
            );
          },
        )}
        <div className="button-row">
          <button className="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Newer
          </button>
          <button className="secondary" onClick={() => setPage(page + 1)}>
            Older
          </button>
        </div>
      </section>
    </>
  );
}
