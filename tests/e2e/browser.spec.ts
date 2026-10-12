import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const runtimeErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(({ page }) => {
  expect(runtimeErrors.get(page)).toEqual([]);
});
test('mobile dashboard keeps all nutrients visible and navigates without overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await expect(page.getByText('Protein', { exact: true })).toBeVisible();
  await expect(page.getByText('Carbohydrates', { exact: true })).toBeVisible();
  await expect(page.getByText('Fat', { exact: true })).toBeVisible();
  expect(await page.locator('.macro-grid').boundingBox()).toMatchObject({ y: expect.any(Number) });
  const macroBottom = await page
    .locator('.macro-grid')
    .evaluate((e) => e.getBoundingClientRect().bottom);
  expect(macroBottom).toBeLessThan(650);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Add Food', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Welcome to Everyday' })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Previous day' }).click();
  await expect(page.getByRole('button', { name: 'Return to today' })).toBeVisible();
  await page.getByRole('button', { name: 'Return to today' }).click();
  await page.getByRole('button', { name: 'Foods', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your foods' })).toBeVisible();
  await page.getByRole('button', { name: 'Recipes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Recipes', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'History', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Daily targets' })).toBeVisible();
});
test('desktop dashboard renders without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Daily nutrition' })).toBeVisible();
  await page.screenshot({ path: '/tmp/everyday-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/everyday-mobile.png', fullPage: true });
});

test('Today dashboard meets automated WCAG 2 AA checks', async ({ page }) => {
  await page.goto('/');
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(result.violations).toEqual([]);
  await page.emulateMedia({ colorScheme: 'dark' });
  const dark = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(dark.violations).toEqual([]);
});

test('large USDA reference library loads and searches by multiple terms', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Foods', exact: true }).first().click();
  await expect(page.getByText(/8857 searchable foods/)).toBeVisible();
  await page.getByLabel('Search your food library').fill('lentils raw');
  await expect(
    page.locator('.starter-library').getByRole('button', { name: /Lentils, raw/ }),
  ).toBeVisible();
  await expect(page.locator('.starter-library').getByText(/USDA SR28 · 352 kcal/)).toBeVisible();
});

test('mobile history has readable dates and 44px controls without page overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.getByRole('button', { name: '30 days', exact: true }).click();
  const buttons = page.locator('.history-chart button');
  await expect(buttons).toHaveCount(30);
  expect(
    await buttons.first().evaluate((el) => el.getBoundingClientRect().width),
  ).toBeGreaterThanOrEqual(44);
  expect(
    await page
      .locator('.history-chart small')
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(12);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await buttons.last().scrollIntoViewIfNeeded();
  await expect(buttons.last()).toBeInViewport();
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({ path: '/tmp/everyday-ux-history.png', fullPage: true });
});

test('narrow mobile dialog follows the visible viewport and restores keyboard focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 600 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole('button', { name: 'Add Food', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
  await page.setViewportSize({ width: 320, height: 400 });
  const bounds = await page.getByRole('dialog').boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(400);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Add Food', exact: true })).toBeFocused();
});

test('a tap inside dialog padding does not cancel the task', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Add Food', exact: true }).click();
  const box = await page.getByRole('dialog').boundingBox();
  await page.mouse.click(box!.x + 5, box!.y + 100);
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 2000 });
});

test('keyboard users can skip repeated navigation and reach the main task', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content', exact: true })).toBeFocused({
    timeout: 2000,
  });
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('main :focus')).toBeVisible();
});

test('slow reference loading does not announce a false empty result', async ({ page }) => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/src/data/usda-sr28.json*', async (route) => {
    await waiting;
    await route.continue();
  });
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Foods', exact: true }).first().click();
    await page.getByLabel('Search your food library').fill('lentils raw');
    await expect(page.getByText('Loading USDA reference foods…', { exact: true })).toBeVisible();
    await expect(page.getByText(/No reference matches/)).toHaveCount(0, { timeout: 2000 });
    release();
    await expect(
      page.locator('.starter-library').getByRole('button', { name: /Lentils, raw/ }),
    ).toBeVisible();
  } finally {
    release();
  }
});

test('mobile date arrows have independent hit areas and advance the diary', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const calendar = page.getByLabel('Select diary date');
  await calendar.fill('2026-10-01');
  const input = await calendar.boundingBox();
  const container = await page.locator('.date-picker').boundingBox();
  expect(input!.height).toBeLessThanOrEqual(container!.height);
  expect(input!.x + input!.width).toBeLessThanOrEqual(container!.x + container!.width + 1);
  await page.getByRole('button', { name: 'Previous day', exact: true }).click();
  await expect(calendar).toHaveValue('2026-09-30');
  const next = page.getByRole('button', { name: 'Next day', exact: true });
  const bounds = await next.boundingBox();
  expect(
    await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.getAttribute('aria-label'),
      { x: bounds!.x + bounds!.width / 2, y: bounds!.y + bounds!.height / 2 },
    ),
  ).toBe('Next day');
  await next.click();
  await expect(calendar).toHaveValue('2026-10-01');
  await next.click();
  await expect(calendar).toHaveValue('2026-10-02');
});
