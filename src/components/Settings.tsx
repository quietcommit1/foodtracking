import { useState } from 'react';
import Modal from './Modal';
import SavedMealEditor from './SavedMealEditor';
import { base, op, useStore, supabase, serverBackup, restore } from '../store';
import { localDate, targetAt } from '../nutrition';
import { nutrientKeys, type Data, type Profile } from '../types';
import { csv, download, validateBackup } from '../backup';
export default function Settings({
  onClose,
  email,
  onSignIn,
}: {
  onClose: () => void;
  email?: string;
  onSignIn: () => void;
}) {
  const { data, queue, mutate, owner } = useStore();
  const [effective, setEffective] = useState(localDate());
  const [nutrition, setNutrition] = useState(targetAt(data.nutrition_targets, localDate()));
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [imported, setImported] = useState<Data | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    try {
      const existing = data.nutrition_targets.find((t) => t.effective_date === effective);
      await mutate([
        op('nutrition_targets', { ...(existing ?? base()), effective_date: effective, nutrition }),
      ]);
      setMessage('Targets saved. Earlier dates keep their previous targets.');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function backup(type: 'json' | 'csv') {
    setError('');
    setBusy(true);
    try {
      if (queue.length) throw Error('Sync pending changes before a complete server backup');
      const all = await serverBackup();
      if (type === 'json')
        download(
          JSON.stringify({ version: 1, exported_at: new Date().toISOString(), data: all }, null, 2),
          `everyday-${localDate()}.json`,
          'application/json',
        );
      else download(csv(all), `everyday-diary-${localDate()}.csv`, 'text/csv');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function read(file?: File) {
    setError('');
    setImported(null);
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setError('Backup exceeds the 20 MB limit');
      return;
    }
    try {
      setImported(validateBackup(JSON.parse(await file.text())));
      setConfirmation('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function doRestore() {
    setBusy(true);
    setError('');
    try {
      await restore(imported!);
      setImported(null);
      setMessage('Backup restored transactionally. All rows belong to this account.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Settings" onClose={onClose}>
      <section>
        <h3>Your account</h3>
        <p className="muted">{email ?? 'Sign in to save and sync your diary.'}</p>
        {email ? (
          <button
            className="secondary"
            onClick={async () => {
              if (
                queue.length &&
                !window.confirm('Pending changes stay cached for this account. Sign out anyway?')
              )
                return;
              await supabase?.auth.signOut();
              onClose();
            }}
          >
            Sign out
          </button>
        ) : (
          <button className="primary" onClick={onSignIn}>
            Sign in
          </button>
        )}
      </section>
      <section>
        <h3>Daily targets</h3>
        <p className="muted">Set your own goals. Blank means unset; zero is an explicit target.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label>
            Effective from
            <input
              type="date"
              required
              value={effective}
              onChange={(e) => {
                setEffective(e.target.value);
                setNutrition(targetAt(data.nutrition_targets, e.target.value));
              }}
            />
          </label>
          <div className="form-grid">
            {nutrientKeys
              .filter((k) => k !== 'fibre')
              .map((k) => (
                <label key={k}>
                  {k === 'carbs' ? 'Carbohydrates' : k[0].toUpperCase() + k.slice(1)} (
                  {k === 'calories' ? 'kcal' : 'g'})
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={nutrition[k] ?? ''}
                    onChange={(e) =>
                      setNutrition({
                        ...nutrition,
                        [k]: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                  />
                </label>
              ))}
          </div>
          <button className="primary" disabled={!owner}>
            Save targets
          </button>
        </form>
      </section>
      <section>
        <h3>Appearance</h3>
        <label>
          Theme
          <select
            value={data.profiles[0]?.theme ?? 'system'}
            onChange={(e) => {
              const p: Profile = {
                ...(data.profiles[0] ?? { ...base(), last_meal: 'Breakfast', last_portions: {} }),
                theme: e.target.value as Profile['theme'],
              };
              void mutate([op('profiles', p)]).catch((e) => setError(e.message));
            }}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </section>
      <section>
        <h3>Saved meals</h3>
        <p className="muted">
          Find these in Add Food → Saved meals. Logged entries keep their original nutrition.
        </p>
        {data.saved_meals.length ? (
          data.saved_meals.map((meal) => <SavedMealEditor key={meal.id} meal={meal} />)
        ) : (
          <p className="small muted">Save a logged meal from your diary to reuse its portions.</p>
        )}
      </section>
      <section>
        <h3>Backups & export</h3>
        <p className="muted">
          Complete JSON includes recipes, portions, targets and saved meals. Exports require a
          connection and no pending changes.
        </p>
        <div className="button-row">
          <button
            className="secondary"
            disabled={busy || !owner}
            onClick={() => void backup('json')}
          >
            Export JSON
          </button>
          <button
            className="secondary"
            disabled={busy || !owner}
            onClick={() => void backup('csv')}
          >
            Diary CSV
          </button>
        </div>
        <label>
          Restore version 1 JSON
          <input
            type="file"
            accept="application/json,.json"
            disabled={!owner || busy}
            onChange={(e) => void read(e.target.files?.[0])}
          />
        </label>
        {imported && (
          <div className="notice">
            <strong>Restore preview</strong>
            <p>
              {imported.foods.length} foods, {imported.diary_entries.length} diary entries,{' '}
              {imported.recipes.length} recipes and {imported.nutrition_targets.length} targets.
            </p>
            <p>
              This replaces all data in the signed-in account. Duplicate IDs or barcodes are
              rejected. Download a backup first. Other devices must finish syncing and then refresh.
            </p>
            <label>
              Type REPLACE to confirm
              <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
            </label>
            <button
              className="danger"
              disabled={confirmation !== 'REPLACE' || busy || queue.length > 0}
              onClick={() => void doRestore()}
            >
              Replace my data
            </button>
          </div>
        )}
      </section>
      <section>
        <h3>Sync & privacy</h3>
        <p className="small muted">
          Offline changes stay scoped to the account that created them. Conflicts use the last
          successfully received server write. Nutrition snapshots preserve historical entries.
          External lookup only sends a barcode, never your diary.
        </p>
      </section>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
    </Modal>
  );
}
