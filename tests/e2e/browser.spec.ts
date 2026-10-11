import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
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
