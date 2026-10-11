// Integration UI tests use an explicit fake Supabase HTTP backend, never a hosted project.
import { test, expect, type Page } from '@playwright/test';
import { emptyData, type Data } from '../../src/types';
const uid = '11111111-1111-4111-8111-111111111111';
async function backend(page: Page) {
  const db = emptyData();
  const seen = new Set();
  let external = 0;
  let fail = false;
  await page.route('https://example.supabase.co/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    let payload: any;
    let status = 200;
    if (url.pathname === '/auth/v1/token') {
      payload = {
        access_token: `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify({ sub: uid, exp: Math.floor(Date.now() / 1000) + 3600, aud: 'authenticated', role: 'authenticated' }))}.test-signature`,
        refresh_token: 'test-refresh',
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          id: uid,
          email: 'personal@example.com',
          aud: 'authenticated',
          role: 'authenticated',
          app_metadata: { provider: 'email' },
          user_metadata: {},
          created_at: '2026-10-11T00:00:00Z',
        },
      };
    } else if (url.pathname === '/functions/v1/food-lookup') {
      external++;
      payload = { status: 'not_found', barcode: request.postDataJSON().barcode };
    } else if (url.pathname.includes('/rpc/')) {
      const name = url.pathname.split('/').pop();
      const body = request.postDataJSON();
      if (name === 'apply_operations') {
        if (fail) {
          status = 503;
          payload = { message: 'Project unavailable' };
        } else {
          for (const op of body.ops) {
            if (seen.has(op.id)) continue;
            seen.add(op.id);
            const table = op.table as keyof Data;
            (db[table] as any[]) = db[table].filter((r) => r.id !== op.row.id);
            if (op.action === 'upsert')
              (db[table] as any[]).push({ ...op.row, updated_at: new Date().toISOString() });
          }
          payload = null;
        }
      } else if (name === 'export_backup') payload = { version: 1, data: db };
      else if (name === 'restore_backup') {
        Object.assign(db, body.payload.data);
        payload = null;
      }
    } else if (url.pathname.startsWith('/rest/v1/')) {
      const table = url.pathname.split('/').pop() as keyof Data;
      let rows = db[table] as any[];
      const barcode = url.searchParams.get('barcode');
      if (barcode) rows = rows.filter((r) => r.barcode === barcode.slice(3));
      payload = request.headers().accept?.includes('vnd.pgrst.object') ? (rows[0] ?? null) : rows;
    } else payload = { id: uid, email: 'personal@example.com' };
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) });
  });
  return { db, external: () => external, setFailed: (value: boolean) => (fail = value) };
}
async function login(page: Page, address = 'http://127.0.0.1:5174') {
  await page.goto(address);
  await page
    .locator('.connection-banner')
    .getByRole('button', { name: 'Sign in', exact: true })
    .click();
  await page.getByLabel('Email', { exact: true }).fill('personal@example.com');
  await page.getByLabel('Password', { exact: true }).fill('secure-test-password');
  await page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: /Synced/ })).toBeVisible();
}
test('missing barcode → manual save → rescan → log → edit historical snapshot', async ({
  page,
}) => {
  const api = await backend(page);
  await login(page);
  await page.getByRole('button', { name: 'Edit targets' }).click();
  await page.getByLabel('Calories (kcal)', { exact: true }).fill('2100');
  await page.getByLabel('Protein (g)', { exact: true }).fill('140');
  await page.getByLabel('Carbohydrates (g)', { exact: true }).fill('200');
  await page.getByLabel('Fat (g)', { exact: true }).fill('60');
  await page.getByRole('button', { name: 'Save targets' }).click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect.poll(() => api.db.nutrition_targets.length).toBe(1);
  await page.getByRole('button', { name: 'Scan Barcode', exact: true }).click();
  await page.getByLabel('Or enter barcode').fill('8901234567890');
  await page.getByRole('button', { name: 'Look up product' }).click();
  await expect(page.getByText(/Product not found/)).toBeVisible();
  await expect(page.getByLabel('Barcode (optional)', { exact: true })).toHaveValue('8901234567890');
  await page.getByLabel('Food or product name').fill('Homemade paneer snack');
  await page.getByLabel('Calories (kcal)', { exact: true }).fill('300');
  await page.getByLabel('Protein (g)', { exact: true }).fill('20');
  await page.getByLabel('Carbohydrates (g)', { exact: true }).fill('4');
  await page.getByLabel('Fat (g)', { exact: true }).fill('24');
  await page.getByRole('button', { name: 'Save to my foods' }).click();
  await expect.poll(() => api.db.foods.length).toBe(1);
  expect(api.external()).toBe(1);
  await page.getByRole('button', { name: 'Scan Barcode', exact: true }).click();
  await page.getByLabel('Or enter barcode').fill('8901234567890');
  await page.getByRole('button', { name: 'Look up product' }).click();
  await expect(page.getByRole('heading', { name: 'Add to your diary' })).toBeVisible();
  expect(api.external()).toBe(1);
  await page.getByLabel('Quantity', { exact: true }).fill('50');
  await page.getByRole('dialog').getByRole('button', { name: 'Add food', exact: true }).click();
  await expect.poll(() => api.db.diary_entries.length).toBe(1);
  expect(api.db.diary_entries[0].nutrition.calories).toBe(150);
  await expect(page.locator('.ring-label strong')).toHaveText('150');
  await expect(page.getByText('130 g remaining')).toBeVisible();
  await page.getByRole('button', { name: 'Foods', exact: true }).first().click();
  await page.getByRole('button', { name: 'Edit Homemade paneer snack' }).click();
  await page.getByLabel('Calories (kcal)', { exact: true }).fill('500');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect.poll(() => api.db.foods[0].nutrition.calories).toBe(500);
  expect(api.db.diary_entries[0].nutrition.calories).toBe(150);
  await page.getByRole('button', { name: 'Today', exact: true }).first().click();
  await page.getByRole('button', { name: 'Edit Homemade paneer snack' }).click();
  await page.getByLabel('Quantity', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect.poll(() => api.db.diary_entries[0].nutrition.calories).toBe(300);
  await expect(page.locator('.ring-label strong')).toHaveText('300');
});
test('failed sync retains edits and a retry does not duplicate diary entries', async ({ page }) => {
  const api = await backend(page);
  await login(page);
  api.setFailed(true);
  await page.getByRole('button', { name: 'Add Food', exact: true }).click();
  await page.getByRole('button', { name: 'Quick calories', exact: true }).click();
  await page.getByLabel('Entry name').fill('Chai');
  await page.getByLabel('Calories (kcal)', { exact: true }).fill('80');
  await page.getByRole('dialog').getByRole('button', { name: 'Add food', exact: true }).click();
  await expect(page.getByText('Sync failed.', { exact: true })).toBeVisible();
  await expect(page.locator('.ring-label strong')).toHaveText('80');
  expect(api.db.diary_entries.length).toBe(0);
  api.setFailed(false);
  await page.getByRole('button', { name: 'Retry sync', exact: true }).click();
  await expect.poll(() => api.db.diary_entries.length).toBe(1);
  await expect(page.getByRole('button', { name: /Synced/ })).toBeVisible();
  await page.getByRole('button', { name: /Synced/ }).click();
  expect(api.db.diary_entries.length).toBe(1);
});

test('production PWA survives offline reload and syncs a cached custom product once', async ({
  page,
  context,
}) => {
  const api = await backend(page);
  await login(page, 'http://127.0.0.1:5175');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByRole('button', { name: /Synced/ })).toBeVisible();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Foods', exact: true }).first().click();
  await page.getByRole('button', { name: 'New food' }).click();
  await page.getByLabel('Food or product name').fill('Offline homemade dal');
  await page.getByLabel('Calories (kcal)', { exact: true }).fill('90');
  await page.getByRole('button', { name: 'Save to my foods' }).click();
  await expect(page.getByText('Offline homemade dal', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /Pending/ })).toBeVisible();
  await page.getByRole('button', { name: 'Foods', exact: true }).first().click();
  await expect(page.getByText('Offline homemade dal', { exact: true })).toBeVisible();
  expect(api.db.foods.length).toBe(0);
  await context.setOffline(false);
  await expect.poll(() => api.db.foods.length).toBe(1);
  await expect(page.getByRole('button', { name: /Synced/ })).toBeVisible();
  expect(api.db.foods[0].name).toBe('Offline homemade dal');
});
