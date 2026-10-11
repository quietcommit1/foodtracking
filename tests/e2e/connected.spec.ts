// Integration UI tests use an explicit fake Supabase HTTP backend, never a hosted project.
import { test, expect, type Page } from '@playwright/test';
import bwip from 'bwip-js/node';
import { emptyData, type Data } from '../../src/types';
const runtimeErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(({ page }) => {
  expect(runtimeErrors.get(page)).toEqual([]);
});
const uid = '11111111-1111-4111-8111-111111111111';
async function backend(page: Page) {
  const db = emptyData();
  const seen = new Set();
  let external = 0;
  let product: unknown = null;
  let lookupStatus = 200;
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
      status = lookupStatus;
      payload =
        status === 404
          ? { code: 'NOT_FOUND', message: 'Requested function was not found' }
          : product
            ? {
                status: 'found',
                product,
                barcode: request.postDataJSON().barcode,
                source_id: request.postDataJSON().barcode,
                source_url:
                  'https://world.openfoodfacts.org/product/' + request.postDataJSON().barcode,
              }
            : { status: 'not_found', barcode: request.postDataJSON().barcode };
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
  return {
    db,
    external: () => external,
    setFailed: (value: boolean) => (fail = value),
    setProduct: (value: unknown) => (product = value),
    setLookupStatus: (value: number) => (lookupStatus = value),
  };
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
  await page.getByRole('button', { name: 'Save & log food' }).click();
  await expect.poll(() => api.db.foods.length).toBe(1);
  await expect(page.getByRole('heading', { name: 'Add to your diary' })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
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
  const manifest = await page.evaluate(async () => {
    const url = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!.href;
    return (await fetch(url)).json();
  });
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('/');
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    /viewport-fit=cover/,
  );
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
  // The visible card is optimistic; the closed form confirms the IndexedDB write completed.
  await expect(page.getByRole('dialog')).not.toBeVisible();
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

test('starter search logs fractional soya chunks and saves a reusable private food', async ({
  page,
}) => {
  const api = await backend(page);
  await login(page);
  await page.getByRole('button', { name: 'Add Food', exact: true }).click();
  await page.getByLabel('Search saved foods').fill('soya chunks');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Soya chunks — dry/ })
    .click();
  await expect(
    page.getByText(/Starter estimate — review against your package or recipe/),
  ).toBeVisible();
  await page.getByLabel('Quantity', { exact: true }).fill('25');
  await page.getByRole('dialog').getByRole('button', { name: 'Add food', exact: true }).click();
  await expect.poll(() => api.db.diary_entries.length).toBe(1);
  expect(api.db.foods.length).toBe(1);
  expect(api.db.foods[0].user_id).toBe(uid);
  expect(api.db.diary_entries[0].food_id).toBe(api.db.foods[0].id);
  expect(api.db.diary_entries[0].nutrition).toEqual({
    calories: 86.25,
    protein: 13,
    carbs: 8.25,
    fat: 0.125,
    fibre: null,
  });
  await page.getByRole('button', { name: 'Add Food', exact: true }).click();
  await page.getByLabel('Search saved foods').fill('soya chunks');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Soya chunks — dry/ })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Add food', exact: true }).click();
  await expect.poll(() => api.db.diary_entries.length).toBe(2);
  expect(api.db.foods.length).toBe(1);
  expect(api.external()).toBe(0);
});

test('Foods starter search opens nutrition review and saves without logging', async ({ page }) => {
  const api = await backend(page);
  await login(page);
  await page.getByRole('button', { name: 'Foods', exact: true }).first().click();
  await page.getByLabel('Search your food library').fill('soya chunks');
  await page.getByRole('button', { name: /Soya chunks — dry/ }).click();
  await expect(page.getByLabel('Protein (g)', { exact: true })).toHaveValue('52');
  await page.getByLabel('Protein (g)', { exact: true }).fill('50');
  await page.getByRole('button', { name: 'Save to my foods', exact: true }).click();
  await expect.poll(() => api.db.foods.length).toBe(1);
  expect(api.db.foods[0].nutrition.protein).toBe(50);
  expect((api.db.foods[0].source_data as any).nutrition.protein).toBe(52);
  expect(api.db.diary_entries).toHaveLength(0);
});

test('scanned OFF legacy product fills all macros, saves and rescans without external lookup', async ({
  page,
}) => {
  const api = await backend(page);
  await login(page);
  api.setProduct({
    product_name: 'Labelled soya chunks',
    brands: 'Fixture brand',
    nutriments: {
      'energy-kcal_100g': 345,
      proteins_100g: 52,
      carbohydrates_100g: 33,
      fat_100g: 0.5,
    },
  });
  await page.getByRole('button', { name: 'Scan Barcode', exact: true }).click();
  await page.getByLabel('Or enter barcode').fill('8901234567890');
  await page.getByRole('button', { name: 'Look up product' }).click();
  await expect(page.getByLabel('Calories (kcal)', { exact: true })).toHaveValue('345');
  await expect(page.getByLabel('Protein (g)', { exact: true })).toHaveValue('52');
  await expect(page.getByLabel('Carbohydrates (g)', { exact: true })).toHaveValue('33');
  await expect(page.getByLabel('Fat (g)', { exact: true })).toHaveValue('0.5');
  await page.getByRole('button', { name: 'Save & log food', exact: true }).click();
  await expect.poll(() => api.db.foods.length).toBe(1);
  await expect(page.getByRole('heading', { name: 'Add to your diary' })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Scan Barcode', exact: true }).click();
  await page.getByLabel('Or enter barcode').fill('8901234567890');
  await page.getByRole('button', { name: 'Look up product' }).click();
  await expect(page.getByRole('heading', { name: 'Add to your diary' })).toBeVisible();
  expect(api.external()).toBe(1);
});

test('undeployed lookup service is distinguished from a missing product', async ({ page }) => {
  const api = await backend(page);
  await login(page);
  api.setLookupStatus(404);
  await page.getByRole('button', { name: 'Scan Barcode', exact: true }).click();
  await page.getByLabel('Or enter barcode').fill('8901234567890');
  await page.getByRole('button', { name: 'Look up product' }).click();
  await expect(page.getByText(/External barcode lookup has not been deployed/)).toBeVisible();
  await expect(page.getByLabel('Barcode (optional)', { exact: true })).toHaveValue('8901234567890');
});

test('real barcode photo decodes locally and explains an empty OFF nutrition record', async ({
  page,
}) => {
  const api = await backend(page);
  await login(page);
  api.setProduct({ code: '8906133020187' });
  let sent: unknown;
  page.on('request', (request) => {
    if (request.url().includes('/functions/v1/food-lookup')) sent = request.postDataJSON();
  });
  await page.getByRole('button', { name: 'Scan Barcode', exact: true }).click();
  const buffer = await bwip.toBuffer({
    bcid: 'ean13',
    text: '890613302018',
    scale: 3,
    height: 30,
    paddingwidth: 30,
    paddingheight: 20,
    backgroundcolor: 'FFFFFF',
  });
  await page
    .getByLabel('Scan from a barcode photo')
    .setInputFiles({ name: 'nakpro-barcode-fixture.png', mimeType: 'image/png', buffer });
  await expect(
    page.getByText(/Product record found, but Open Food Facts has no nutrition values/),
  ).toBeVisible();
  await expect(page.getByLabel('Barcode (optional)', { exact: true })).toHaveValue('8906133020187');
  await expect(page.getByLabel('Protein (g)', { exact: true })).toHaveValue('');
  expect(sent).toEqual({ barcode: '8906133020187' });
});

test('mobile food choice shows weight immediately with stable input sizing and a live protein preview', async ({
  page,
}) => {
  const api = await backend(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.getByRole('button', { name: 'Add Food', exact: true }).click();
  await page.getByLabel('Search saved foods').fill('soya chunks');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Soya chunks — dry/ })
    .click();
  const quantity = page.getByLabel('Quantity', { exact: true });
  await expect(quantity).toBeFocused();
  await expect(page.getByLabel('Search saved foods')).toHaveCount(0);
  expect(
    await quantity.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  const bounds = await quantity.boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThan(700);
  await quantity.fill('25');
  await expect(page.getByLabel('Nutrition for this portion')).toContainText('13 g protein');
  await expect(page.getByLabel('Nutrition for this portion')).toContainText('86.3 kcal');
  // A reduced viewport catches clipped dialogs; it is not an actual iOS keyboard test.
  await page.setViewportSize({ width: 390, height: 460 });
  await expect
    .poll(async () => (await page.getByRole('dialog').boundingBox())!.height)
    .toBeLessThanOrEqual(432);
  await expect
    .poll(async () => {
      const box = (await page.getByRole('dialog').boundingBox())!;
      return box.y >= 0 && box.y + box.height <= 460;
    })
    .toBe(true);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Add food', exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Add food', exact: true }),
  ).toBeInViewport();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('dialog').screenshot({ path: '/tmp/everyday-portion-step.png' });
  await page.getByRole('button', { name: 'Change food' }).click();
  await expect(page.getByLabel('Search saved foods')).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Soya chunks — dry/ })
    .click();
  await quantity.fill('25');
  await page.getByRole('dialog').getByRole('button', { name: 'Add food', exact: true }).click();
  await expect.poll(() => api.db.diary_entries.length).toBe(1);
  const breakfast = page.getByRole('article', { name: 'Breakfast', exact: true });
  await expect(breakfast.getByRole('group', { name: 'Breakfast nutrition totals' })).toContainText(
    '13 g protein',
  );
  await expect(breakfast.locator('.entry-protein')).toHaveText('13 g protein');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await breakfast.screenshot({ path: '/tmp/everyday-meal-protein.png' });
});

test('creating food preserves past-date meal context and protects the draft', async ({ page }) => {
  const api = await backend(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.getByRole('button', { name: 'Previous day' }).click();
  const date = await page.getByLabel('Select diary date').inputValue();
  await page.getByRole('button', { name: 'Add food to Lunch', exact: true }).click();
  await page.getByRole('button', { name: '+ Create a custom food', exact: true }).click();
  await page.getByLabel('Food or product name').fill('My lunch paneer');
  await page.getByLabel('Calories (kcal)', { exact: true }).fill('200');
  await page.getByLabel('Protein (g)', { exact: true }).fill('20');
  await page.keyboard.press('Escape');
  await expect(page.getByText('You have unsaved changes.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.getByLabel('Protein (g)', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Food or product name')).toHaveValue('My lunch paneer');
  await page.getByRole('button', { name: 'Save & log food', exact: true }).click();
  await expect(page.getByLabel('Date', { exact: true })).toHaveValue(date);
  await expect(page.getByLabel('Meal', { exact: true })).toHaveValue('Lunch');
  await page.getByLabel('Quantity', { exact: true }).fill('50');
  await page.getByRole('dialog').getByRole('button', { name: 'Add food', exact: true }).click();
  await expect.poll(() => api.db.diary_entries.length).toBe(1);
  expect(api.db.diary_entries[0]).toMatchObject({
    date,
    meal: 'Lunch',
    nutrition: { calories: 100, protein: 10, carbs: null },
  });
});

test('device storage failure keeps the food form editable and retry creates one product', async ({
  page,
}) => {
  const api = await backend(page);
  await login(page);
  await page.getByRole('button', { name: 'Foods', exact: true }).first().click();
  await page.getByRole('button', { name: 'New food', exact: true }).click();
  await page.getByLabel('Food or product name').fill('Device save retry');
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    (window as any).restoreWrite = () => {
      IDBObjectStore.prototype.put = original;
    };
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) {
      if (this.name === 'accounts') throw new DOMException('Quota exhausted', 'QuotaExceededError');
      return original.apply(this, args);
    };
  });
  await page.getByRole('button', { name: 'Save to my foods', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'Your inputs are retained',
  );
  await expect(page.getByLabel('Food or product name')).toHaveValue('Device save retry');
  expect(api.db.foods).toHaveLength(0);
  await page.evaluate(() => (window as any).restoreWrite());
  await page.getByRole('button', { name: 'Save to my foods', exact: true }).click();
  await expect.poll(() => api.db.foods.length).toBe(1);
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('recipe ingredient search and inline quantity changes preserve cooked-weight calculations', async ({
  page,
}) => {
  const api = await backend(page);
  await login(page);
  await page.getByRole('button', { name: 'Recipes', exact: true }).first().click();
  await page.getByRole('button', { name: 'New recipe', exact: true }).click();
  await page.getByLabel('Recipe name').fill('Soya recipe fixture');
  await page.getByLabel('Number of servings').fill('2');
  await page.getByLabel('Final cooked weight (g, optional)').fill('200');
  await page.getByLabel('Search ingredients').fill('soya chunks');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Soya chunks — dry/ })
    .click();
  await page.getByLabel('Quantity in g', { exact: true }).fill('25');
  await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByLabel('Quantity for Soya chunks — dry (g)', { exact: true }).fill('50');
  await expect(page.getByText('Batch: 172.5 kcal', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save recipe & logging food', exact: true }).click();
  await expect.poll(() => api.db.recipes.length).toBe(1);
  expect(api.db.foods.find((food) => food.source === 'recipe')?.nutrition).toMatchObject({
    calories: 86.25,
    protein: 13,
    fibre: null,
  });
  expect(api.db.recipe_ingredients[0].quantity).toBe(50);
});

test('nutrition basis changes require review before a product can be saved', async ({ page }) => {
  const api = await backend(page);
  await login(page);
  await page.getByRole('button', { name: 'Foods', exact: true }).first().click();
  await page.getByRole('button', { name: 'New food', exact: true }).click();
  await page.getByLabel('Food or product name').fill('Basis review fixture');
  await page.getByLabel('Calories (kcal)', { exact: true }).fill('200');
  await page.getByLabel('Nutrition basis').selectOption('serving');
  await expect(page.getByRole('button', { name: 'Save to my foods', exact: true })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('existing numbers have not been converted');
  await page.getByLabel('Calories (kcal)', { exact: true }).fill('100');
  await page.getByRole('checkbox', { name: /I checked that these values/ }).check();
  await page.getByRole('button', { name: 'Save to my foods', exact: true }).click();
  await expect.poll(() => api.db.foods.length).toBe(1);
  expect(api.db.foods[0]).toMatchObject({ basis: 'serving', nutrition: { calories: 100 } });
});

test('saved meals show portions and scaled macros and can be managed without changing diary snapshots', async ({
  page,
}) => {
  const api = await backend(page);
  await login(page);
  await page.getByRole('button', { name: 'Add Food', exact: true }).click();
  await page.getByRole('button', { name: 'Quick calories', exact: true }).click();
  await page.getByLabel('Entry name').fill('Saved chai');
  await page.getByLabel('Calories (kcal)', { exact: true }).fill('80');
  await page.getByRole('dialog').getByRole('button', { name: 'Add food', exact: true }).click();
  await expect.poll(() => api.db.diary_entries.length).toBe(1);
  await page.getByRole('button', { name: 'Save meal', exact: true }).click();
  await page.getByLabel('Meal name', { exact: true }).fill('Morning chai');
  await page.getByRole('button', { name: 'Save for next time', exact: true }).click();
  await expect.poll(() => api.db.saved_meals.length).toBe(1);
  await page.getByRole('button', { name: 'Add Food', exact: true }).click();
  await page.getByRole('button', { name: 'Saved meals', exact: true }).click();
  await page.getByLabel('Saved meal', { exact: true }).selectOption(api.db.saved_meals[0].id);
  await page.getByLabel('Meal multiplier', { exact: true }).fill('2');
  await expect(page.getByLabel('Saved meal nutrition')).toContainText('160 kcal');
  await expect(page.getByLabel('Saved meal nutrition')).toContainText('Unknown g protein');
  await page.getByRole('dialog').getByRole('button', { name: 'Add food', exact: true }).click();
  await expect.poll(() => api.db.diary_entries.length).toBe(2);
  expect(api.db.diary_entries[1].nutrition).toMatchObject({ calories: 160, protein: null });
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
  await page.getByLabel('Saved meal name', { exact: true }).fill('Chai favourite');
  await page.getByRole('button', { name: 'Rename meal', exact: true }).click();
  await expect.poll(() => api.db.saved_meals[0].name).toBe('Chai favourite');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete saved meal', exact: true }).click();
  await expect.poll(() => api.db.saved_meals.length).toBe(0);
  expect(api.db.diary_entries).toHaveLength(2);
  expect(api.db.saved_meal_items).toHaveLength(0);
});

test('Today follows local midnight on resume while a historical date stays selected', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-11T23:59:00') });
  await backend(page);
  await login(page);
  await expect(page.getByLabel('Select diary date')).toHaveValue('2026-10-11');
  await page.clock.setSystemTime(new Date('2026-10-12T00:01:00'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByLabel('Select diary date')).toHaveValue('2026-10-12');
  await page.getByLabel('Select diary date').fill('2026-10-01');
  await page.clock.setSystemTime(new Date('2026-10-13T00:01:00'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByLabel('Select diary date')).toHaveValue('2026-10-01');
});

test('Recent excludes unused foods and searching Favourites keeps that filter', async ({
  page,
}) => {
  const api = await backend(page);
  const food = (id: string, name: string) => ({
    id,
    user_id: uid,
    name,
    brand: '',
    barcode: null,
    basis: 'g' as const,
    basis_amount: 100,
    serving_size: null,
    nutrition: { calories: 100, protein: 10, carbs: 5, fat: 4, fibre: null },
    notes: '',
    source: 'manual' as const,
    source_id: null,
    source_url: null,
    source_data: null,
    state: 'raw' as const,
  });
  api.db.foods.push(
    food(crypto.randomUUID(), 'Green favourite'),
    food(crypto.randomUUID(), 'Green unused'),
  );
  api.db.favourites.push({ id: crypto.randomUUID(), user_id: uid, food_id: api.db.foods[0].id });
  api.db.diary_entries.push({
    id: crypto.randomUUID(),
    user_id: uid,
    food_id: api.db.foods[0].id,
    name: 'Green favourite',
    date: '2026-10-10',
    meal: 'Lunch',
    quantity: 100,
    unit: 'g',
    nutrition: api.db.foods[0].nutrition,
    portion_snapshot: {},
  });
  await login(page);
  await page.getByRole('button', { name: 'Add Food', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: /^Green favourite/ }),
  ).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: /^Green unused/ })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Favourites', exact: true }).click();
  await page.getByLabel('Search saved foods').fill('Green');
  await expect(page.getByRole('button', { name: 'Favourites', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('dialog').getByRole('button', { name: /^Green unused/ })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: /^Green unused/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: /^Green unused/ })).toHaveCount(
    0,
  );
});

test('first-time Add Food resumes the requested task after sign-in', async ({ page }) => {
  await backend(page);
  await page.goto('http://127.0.0.1:5174');
  await page.getByRole('button', { name: 'Add Food', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill('personal@example.com');
  await page.getByLabel('Password', { exact: true }).fill('secure-test-password');
  await page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Add to your diary', exact: true })).toBeVisible({
    timeout: 2000,
  });
});

test('first-time reference selection survives sign-in without choosing the food again', async ({
  page,
}) => {
  await backend(page);
  await page.goto('http://127.0.0.1:5174');
  await page.getByRole('button', { name: 'Foods', exact: true }).first().click();
  await page.getByLabel('Search your food library').fill('soya chunks');
  await page.getByRole('button', { name: /^Soya chunks — dry/ }).click();
  await page.getByLabel('Email', { exact: true }).fill('personal@example.com');
  await page.getByLabel('Password', { exact: true }).fill('secure-test-password');
  await page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByLabel('Food or product name')).toHaveValue('Soya chunks — dry', {
    timeout: 2000,
  });
});

test('hurried ingredient entry with Enter adds the ingredient rather than submitting the recipe', async ({
  page,
}) => {
  const api = await backend(page);
  await login(page);
  await page.getByRole('button', { name: 'Recipes', exact: true }).first().click();
  await page.getByRole('button', { name: 'New recipe', exact: true }).click();
  await page.getByLabel('Recipe name').fill('Enter key recipe');
  await page.getByLabel('Search ingredients').fill('soya chunks');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Soya chunks — dry/ })
    .click();
  await page.getByLabel('Quantity in g', { exact: true }).fill('25');
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Quantity for Soya chunks — dry (g)', { exact: true })).toBeVisible({
    timeout: 2000,
  });
  expect(api.db.recipes).toHaveLength(0);
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveCount(0);
});

test('empty filtered food library explains the result and offers recovery', async ({ page }) => {
  await backend(page);
  await login(page);
  await page.getByRole('button', { name: 'Foods', exact: true }).first().click();
  await page.getByLabel('Search your food library').fill('soya chunks');
  await page.getByRole('button', { name: /^Soya chunks — dry/ }).click();
  await page.getByRole('button', { name: 'Save to my foods', exact: true }).click();
  await page.getByRole('button', { name: 'Homemade', exact: true }).click();
  await expect(page.getByText('No foods match these filters.', { exact: true })).toBeVisible({
    timeout: 2000,
  });
  await page.getByRole('button', { name: 'Clear food filters', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Log food', exact: true })).toBeVisible();
});

for (const recovery of ['cancel', 'new-task'] as const) {
  test(`a slow barcode lookup cannot replace a newer task (${recovery})`, async ({ page }) => {
    await backend(page);
    await login(page);
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    let received = false;
    await page.route('**/functions/v1/food-lookup', async (route) => {
      received = true;
      await waiting;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'not_found' }),
      });
    });
    try {
      await page.getByRole('button', { name: 'Scan Barcode', exact: true }).click();
      await page.getByLabel('Or enter barcode').fill('8901234567890');
      await page.getByRole('button', { name: 'Look up product', exact: true }).click();
      await expect.poll(() => received).toBe(true);
      await expect(page.getByRole('button', { name: 'Scan Barcode', exact: true })).toBeDisabled({
        timeout: 2000,
      });
      if (recovery === 'cancel')
        await page.getByRole('button', { name: 'Cancel lookup', exact: true }).click();
      await page.getByRole('button', { name: 'Add Food', exact: true }).click();
      release();
      await expect(
        page.getByRole('heading', { name: 'Add to your diary', exact: true }),
      ).toBeVisible();
      await expect(page.getByText(/Product not found/)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Cancel lookup', exact: true })).toHaveCount(0);
    } finally {
      release();
    }
  });
}

test('a complete quick-entry workflow works using only the keyboard', async ({ page }) => {
  const api = await backend(page);
  await login(page);
  async function tabTo(locator: ReturnType<Page['getByRole']>) {
    for (let n = 0; n < 60; n++) {
      if (await locator.evaluate((el) => el === document.activeElement)) return;
      await page.keyboard.press('Tab');
    }
    throw new Error('Control cannot be reached using Tab');
  }
  await tabTo(page.getByRole('button', { name: 'Add Food', exact: true }));
  await page.keyboard.press('Enter');
  await tabTo(page.getByRole('button', { name: 'Quick calories', exact: true }));
  await page.keyboard.press('Enter');
  await tabTo(page.getByLabel('Entry name', { exact: true }));
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Keyboard snack');
  await tabTo(page.getByLabel('Calories (kcal)', { exact: true }));
  await page.keyboard.type('125');
  await tabTo(page.getByRole('dialog').getByRole('button', { name: 'Add food', exact: true }));
  await page.keyboard.press('Enter');
  await expect.poll(() => api.db.diary_entries.length).toBe(1);
  expect(api.db.diary_entries[0].nutrition.calories).toBe(125);
  expect(api.db.diary_entries[0].nutrition.protein).toBeNull();
  await expect(page.locator('.ring-label strong')).toHaveText('125');
});
