import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import {
  Leaf,
  LayoutDashboard,
  Utensils,
  BookOpen,
  ChartNoAxesColumn,
  Settings as SettingsIcon,
  Search,
  Plus,
  ScanLine,
  Star,
  Pencil,
  Trash2,
  CloudCheck,
  CloudOff,
  RefreshCw,
  ArrowRight,
  LogIn,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase, setAccount, useStore, op, base, lookupBarcode, discardPending } from './store';
import { localDate, fmt, normalizeBarcode, unknown } from './nutrition';
import {
  type Food,
  type Recipe,
  type Entry,
  type Meal,
  type Nutrition,
  nutrientKeys,
} from './types';
import Dashboard from './components/Dashboard';
import Auth from './components/Auth';
import FoodForm from './components/FoodForm';
import AddFood from './components/AddFood';
import StarterLibrary from './components/StarterLibrary';
import { catalogDraft, catalogNoticeFor, matchesFood, librarySourceLabel } from './catalog';
import RecipeForm from './components/RecipeForm';
import Settings from './components/Settings';
import History from './components/History';
import Modal from './components/Modal';
import { download } from './backup';
import { externalFood } from './off';
const Scanner = lazy(() => import('./components/Scanner'));
type Dialog =
  | { kind: 'auth' }
  | { kind: 'settings' }
  | { kind: 'scan' }
  | { kind: 'food'; food?: Food; barcode?: string; notice?: string }
  | { kind: 'add'; food?: Food; meal?: Meal; entry?: Entry }
  | { kind: 'recipe'; recipe?: Recipe }
  | { kind: 'delete'; food: Food };
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState('Today');
  const [date, setDate] = useState(localDate());
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All foods');
  const [lookup, setLookup] = useState(false);
  const [toast, setToast] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const accountRef = useRef<string | null>(null);
  const store = useStore();
  const { data, queue, error, syncing, loading, hydrated, mutate } = store;
  useEffect(() => {
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      const uid = session?.user?.id ?? null;
      if (accountRef.current !== uid) {
        accountRef.current = uid;
        setDialog(null);
        void setAccount(uid).catch((e) => setToast(e.message));
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  useEffect(() => {
    const theme = data.profiles[0]?.theme ?? 'system';
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () =>
      (document.documentElement.dataset.theme =
        theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [data.profiles]);
  function requireAuth(d: Dialog) {
    if (loading) {
      setToast('Your account cache is loading. Please try again in a moment.');
      return;
    }
    setDialog(user ? d : { kind: 'auth' });
  }
  async function scan(code: string) {
    setDialog(null);
    setLookup(true);
    try {
      const barcode = normalizeBarcode(code);
      const cached = data.foods.find((f) => f.barcode === barcode);
      if (cached) {
        setDialog({ kind: 'add', food: cached });
        return;
      }
      if (!navigator.onLine) {
        setDialog({
          kind: 'food',
          barcode,
          notice: 'You’re offline. Create a private product now; it will sync when you reconnect.',
        });
        return;
      }
      const result = await lookupBarcode(barcode);
      if (result.status === 'saved') setDialog({ kind: 'add', food: result.food });
      else if (result.status === 'found') {
        const food = externalFood(result, base());
        const missing = nutrientKeys.slice(0, 4).filter((key) => food.nutrition[key] === null);
        setDialog({
          kind: 'food',
          food,
          notice:
            missing.length === 4
              ? 'Product record found, but Open Food Facts has no nutrition values for this barcode. Enter the package label once and save it; future scans will use your private saved values.'
              : missing.length
                ? 'Product found with incomplete nutrition. Review the supplied values and fill only missing values printed on the package.'
                : 'External result — review every nutrient and confirm the nutrition basis before saving.',
        });
      } else
        setDialog({
          kind: 'food',
          barcode,
          notice:
            result.status === 'not_found'
              ? 'Product not found. Add the package nutrition to recognise it next time.'
              : (result.message ?? 'Lookup unavailable. You can enter nutrition manually.'),
        });
    } catch (e) {
      setDialog({
        kind: 'food',
        barcode: code,
        notice: `Lookup unavailable: ${(e as Error).message}. Manual entry is available.`,
      });
    } finally {
      setLookup(false);
    }
  }
  async function favourite(f: Food) {
    const existing = data.favourites.find((x) => x.food_id === f.id);
    await mutate([
      existing
        ? op('favourites', existing, 'delete')
        : op('favourites', { ...base(), food_id: f.id }),
    ]);
  }
  const nav = [
    { name: 'Today', icon: LayoutDashboard },
    { name: 'Foods', icon: Utensils },
    { name: 'Recipes', icon: BookOpen },
    { name: 'History', icon: ChartNoAxesColumn },
  ];
  const status = !user
    ? 'Not signed in'
    : syncing
      ? 'Syncing'
      : error
        ? 'Failed'
        : queue.length
          ? 'Pending'
          : !online
            ? 'Offline'
            : hydrated
              ? 'Synced'
              : 'Connecting';
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab('Today');
          }}
        >
          <span className="brand-symbol">
            <Leaf size={26} />
          </span>
          everyday<span className="brand-period">.</span>
        </a>
        <div className="sidebar-tagline">A place for your plate.</div>
        <div className="nav-label">YOUR SPACE</div>
        <nav aria-label="Main navigation">
          {nav.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={tab === name ? 'active' : ''}
              aria-current={tab === name ? 'page' : undefined}
              onClick={() => {
                setTab(name);
                setSearch('');
              }}
            >
              <Icon size={20} />
              {name}
              {tab === name && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="settings-link" onClick={() => setDialog({ kind: 'settings' })}>
            <SettingsIcon size={20} />
            Settings
          </button>
          <div className="account-card">
            <div className="avatar">{user?.email?.[0].toUpperCase() ?? 'Y'}</div>
            <div>
              <strong>{user ? 'Your personal diary' : 'Your everyday space'}</strong>
              <small>{user?.email ?? 'Sign in to make it yours'}</small>
            </div>
            <button
              className="icon-button"
              aria-label={user ? 'Account settings' : 'Sign in'}
              onClick={() => setDialog({ kind: user ? 'settings' : 'auth' })}
            >
              {user ? <ArrowRight size={17} /> : <LogIn size={17} />}
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="breadcrumb">
            Your space <span>/</span> <strong>{tab}</strong>
          </span>
          <button
            className={`sync-indicator ${error ? 'sync-error' : ''}`}
            onClick={() => (user ? void store.sync() : setDialog({ kind: 'auth' }))}
            aria-label={`${status}${queue.length ? `, ${queue.length} pending changes` : ''}. Click to retry.`}
          >
            {syncing ? (
              <RefreshCw size={16} className="spin" />
            ) : !online || error ? (
              <CloudOff size={16} />
            ) : (
              <CloudCheck size={16} />
            )}
            <span>
              {status}
              {queue.length > 0 ? ` · ${queue.length}` : ''}
            </span>
          </button>
          <button
            className="top-avatar"
            aria-label="Account"
            onClick={() => setDialog({ kind: user ? 'settings' : 'auth' })}
          >
            {user?.email?.[0].toUpperCase() ?? 'Y'}
          </button>
        </header>
        <main>
          {!supabase && (
            <div className="connection-banner">
              <span>Welcome to Everyday. Connect Supabase to save your private diary.</span>
              <button className="text-button" onClick={() => setDialog({ kind: 'settings' })}>
                Setup details <ArrowRight size={14} />
              </button>
            </div>
          )}
          {supabase && !user && (
            <div className="connection-banner">
              <span>Your meals, synced privately across devices.</span>
              <button className="text-button" onClick={() => setDialog({ kind: 'auth' })}>
                Sign in <ArrowRight size={14} />
              </button>
            </div>
          )}
          {error && (
            <div className="error sync-banner" role="alert">
              <strong>Sync failed.</strong> {error}. Pending edits are retained on this device. If
              the project is paused, resume it in Supabase and retry.
              <button className="text-button" onClick={() => void store.sync()}>
                Retry sync
              </button>
              {queue.length > 0 && (
                <details>
                  <summary>Pending changes</summary>
                  {queue.map((q) => (
                    <div key={q.id}>
                      {q.action} · {q.table} · {q.row.name ?? q.row.date ?? q.row.id}
                    </div>
                  ))}
                  <p>
                    For a duplicate barcode, reload the server library and edit the existing
                    product. Export your pending edits before discarding them.
                  </p>
                  <button
                    className="text-button"
                    onClick={() =>
                      download(
                        JSON.stringify(
                          { version: 1, account: store.owner, operations: queue },
                          null,
                          2,
                        ),
                        'everyday-pending-edits.json',
                        'application/json',
                      )
                    }
                  >
                    Export pending edits
                  </button>
                  <button
                    className="text-button"
                    onClick={() => {
                      if (
                        window.confirm(
                          'Discard all pending changes on this device and reload from Supabase? Export them first if you want to keep a copy.',
                        )
                      )
                        void discardPending().catch((e) => setToast(e.message));
                    }}
                  >
                    Discard pending & reload
                  </button>
                </details>
              )}
            </div>
          )}
          {loading && (
            <p role="status" className="notice">
              Loading your diary…
            </p>
          )}
          {lookup && (
            <p role="status" className="notice">
              Looking up your saved products, then Open Food Facts…
            </p>
          )}
          {toast && (
            <div role="status" className="notice">
              {toast}
              <button className="text-button" onClick={() => setToast('')}>
                Dismiss
              </button>
            </div>
          )}
          {tab === 'Today' && (
            <Dashboard
              date={date}
              setDate={setDate}
              onAdd={(meal) => requireAuth({ kind: 'add', meal })}
              onScan={() => requireAuth({ kind: 'scan' })}
              onEdit={(entry) => requireAuth({ kind: 'add', entry })}
              onSettings={() => setDialog({ kind: 'settings' })}
            />
          )}{' '}
          {tab === 'Foods' && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">FAMILIAR FOODS, FASTER LOGGING</div>
                  <h1>Your foods</h1>
                  <p className="muted">Packaged favourites and the things you make at home.</p>
                </div>
                <button className="primary" onClick={() => requireAuth({ kind: 'food' })}>
                  <Plus size={19} />
                  New food
                </button>
              </div>
              <div className="library-tools">
                <div className="search">
                  <Search size={18} />
                  <input
                    aria-label="Search your food library"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search foods, brands or barcodes"
                  />
                </div>
                <button className="secondary" onClick={() => requireAuth({ kind: 'scan' })}>
                  <ScanLine size={18} />
                  Scan barcode
                </button>
              </div>
              <div className="chips">
                {['All foods', 'Favourites', 'Packaged', 'Homemade'].map((t) => (
                  <button
                    className={filter === t ? 'selected' : ''}
                    onClick={() => setFilter(t)}
                    key={t}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="library-grid">
                {data.foods
                  .filter((f) => matchesFood(f, search))
                  .filter((f) =>
                    filter === 'Favourites'
                      ? data.favourites.some((x) => x.food_id === f.id)
                      : filter === 'Packaged'
                        ? f.state === 'packaged'
                        : filter === 'Homemade'
                          ? f.state !== 'packaged'
                          : true,
                  )
                  .map((f) => (
                    <article className="food-card surface" key={f.id}>
                      <div className="food-card-top">
                        <div className="food-glyph">
                          <Utensils size={23} />
                        </div>
                        <button
                          className={`icon-button ${data.favourites.some((x) => x.food_id === f.id) ? 'is-favourite' : ''}`}
                          aria-label={`Toggle favourite ${f.name}`}
                          onClick={() => void favourite(f)}
                        >
                          <Star size={19} />
                        </button>
                      </div>
                      <h3>{f.name}</h3>
                      <p className="muted small">
                        {f.brand || f.state} ·{' '}
                        {f.source === 'openfoodfacts'
                          ? 'Open Food Facts'
                          : f.source === 'recipe'
                            ? 'Homemade recipe'
                            : librarySourceLabel(f)}
                      </p>
                      <div className="food-calories">
                        <strong>{fmt(f.nutrition.calories)}</strong> kcal{' '}
                        <span>
                          / {f.basis_amount} {f.basis}
                        </span>
                      </div>
                      <div className="food-macros">
                        P {fmt(f.nutrition.protein)} g <span>·</span> C {fmt(f.nutrition.carbs)} g{' '}
                        <span>·</span> F {fmt(f.nutrition.fat)} g
                      </div>
                      {f.barcode && <p className="barcode-text">{f.barcode}</p>}
                      <div className="food-actions">
                        <button
                          className="secondary"
                          onClick={() => requireAuth({ kind: 'add', food: f })}
                        >
                          <Plus size={16} />
                          Log food
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Edit ${f.name}`}
                          onClick={() =>
                            setDialog(
                              f.recipe_id
                                ? {
                                    kind: 'recipe',
                                    recipe: data.recipes.find((r) => r.id === f.recipe_id),
                                  }
                                : { kind: 'food', food: f },
                            )
                          }
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Delete ${f.name}`}
                          onClick={() => setDialog({ kind: 'delete', food: f })}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      {f.source_url && (
                        <a
                          className="small source-link"
                          href={f.source_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {f.source === 'openfoodfacts'
                            ? 'Source: Open Food Facts · ODbL'
                            : librarySourceLabel(f)}{' '}
                          ↗
                        </a>
                      )}
                    </article>
                  ))}
              </div>
              {filter === 'All foods' && (
                <StarterLibrary
                  search={search}
                  saved={data.foods}
                  onChoose={(food) => {
                    if (!user) {
                      setDialog({ kind: 'auth' });
                      return;
                    }
                    requireAuth({
                      kind: 'food',
                      food: catalogDraft(food, base()),
                      notice: catalogNoticeFor(food),
                    });
                  }}
                />
              )}
              {!data.foods.length && (
                <div className="empty-state">
                  <Utensils size={36} />
                  <h2>Your favourites start here.</h2>
                  <p>
                    Save the nutrition on a package, scan a barcode, or add a homemade food.
                    <br />
                    No assumed portion sizes. Just the food you know.
                  </p>
                  <button className="primary" onClick={() => requireAuth({ kind: 'food' })}>
                    Add your first food
                  </button>
                </div>
              )}
            </>
          )}
          {tab === 'Recipes' && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">FROM YOUR KITCHEN</div>
                  <h1>Recipes</h1>
                  <p className="muted">Your ingredients. Your portions. Your everyday cooking.</p>
                </div>
                <button className="primary" onClick={() => requireAuth({ kind: 'recipe' })}>
                  <Plus size={19} />
                  New recipe
                </button>
              </div>
              <div className="library-grid">
                {data.recipes.map((r) => (
                  <article className="surface recipe-card" key={r.id}>
                    <div className="recipe-glyph">
                      <BookOpen size={30} />
                    </div>
                    <h2>{r.name}</h2>
                    <p className="muted">
                      {r.servings} servings {r.cooked_weight ? `· ${r.cooked_weight} g cooked` : ''}
                    </p>
                    <p>
                      {data.recipe_ingredients.filter((i) => i.recipe_id === r.id).length}{' '}
                      ingredients
                    </p>
                    <div className="button-row">
                      <button
                        className="secondary"
                        onClick={() => setDialog({ kind: 'recipe', recipe: r })}
                      >
                        Edit recipe
                      </button>
                      <button
                        className="primary"
                        onClick={() => {
                          const f = data.foods.find((f) => f.recipe_id === r.id);
                          if (f) setDialog({ kind: 'add', food: f });
                        }}
                      >
                        Log a portion
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {!data.recipes.length && (
                <div className="empty-state">
                  <BookOpen size={38} />
                  <h2>A place for your family recipes.</h2>
                  <p>
                    Add ingredients from your library, including oil and ghee.
                    <br />
                    Use cooked batch weight for accurate gram portions.
                  </p>
                  <button className="primary" onClick={() => requireAuth({ kind: 'recipe' })}>
                    Create your first recipe
                  </button>
                </div>
              )}
            </>
          )}
          {tab === 'History' && (
            <History
              onDate={(d) => {
                setDate(d);
                setTab('Today');
              }}
            />
          )}
          <footer className="main-footer">
            <Leaf size={14} /> Everyday · A little more mindful.
          </footer>
        </main>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {nav.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={tab === name ? 'active' : ''}
              onClick={() => setTab(name)}
            >
              <Icon size={21} />
              {name}
            </button>
          ))}
          <button onClick={() => setDialog({ kind: 'settings' })}>
            <SettingsIcon size={21} />
            Settings
          </button>
        </nav>
      </div>
      {dialog?.kind === 'auth' && <Auth onClose={() => setDialog(null)} />}{' '}
      {dialog?.kind === 'settings' && (
        <Settings
          onClose={() => setDialog(null)}
          email={user?.email}
          onSignIn={() => setDialog({ kind: 'auth' })}
        />
      )}{' '}
      {dialog?.kind === 'scan' && (
        <Suspense fallback={<div className="notice">Loading scanner…</div>}>
          <Scanner onClose={() => setDialog(null)} onCode={(code) => void scan(code)} />
        </Suspense>
      )}
      {dialog?.kind === 'food' && (
        <FoodForm
          key={dialog.food?.id ?? dialog.barcode ?? 'new'}
          food={dialog.food}
          barcode={dialog.barcode}
          notice={dialog.notice}
          onClose={() => setDialog(null)}
          onSaved={() =>
            setToast(
              'Food saved locally. It will be synced to your Supabase library. You can now log it from Foods.',
            )
          }
        />
      )}{' '}
      {dialog?.kind === 'add' && (
        <AddFood
          date={date}
          initialFood={dialog.food}
          initialMeal={dialog.meal}
          entry={dialog.entry}
          onClose={() => setDialog(null)}
          onCreate={() => setDialog({ kind: 'food' })}
        />
      )}{' '}
      {dialog?.kind === 'recipe' && (
        <RecipeForm recipe={dialog.recipe} onClose={() => setDialog(null)} />
      )}{' '}
      {dialog?.kind === 'delete' && (
        <Modal title="Delete this library food?" onClose={() => setDialog(null)}>
          <p>
            Historical diary snapshots are preserved. Foods used by recipe ingredients cannot be
            deleted until removed from those recipes.
          </p>
          <button
            className="danger"
            onClick={() => {
              void mutate([op('foods', dialog.food, 'delete')]);
              setDialog(null);
            }}
          >
            Delete {dialog.food.name}
          </button>
        </Modal>
      )}
    </div>
  );
}
