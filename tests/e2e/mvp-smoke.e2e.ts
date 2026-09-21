import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Europe overview' })).toBeVisible();
});

test('opens a Country Map and returns to Europe', async ({ page }) => {
  await page.getByLabel('Choose a country').selectOption('germany');
  await expect(page.getByRole('region', { name: 'Germany preview' })).toBeVisible();

  await page.getByRole('button', { name: 'Enter Germany' }).click();
  await expect(page).toHaveURL(/#country\/germany$/);
  await expect(page.getByRole('heading', { name: 'Germany / Country Map' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Only show domestic routes' })).toBeVisible();

  await page.getByRole('button', { name: 'Back to Europe' }).click();
  await expect(page).toHaveURL(/#europe$/);
  await expect(page.getByRole('heading', { name: 'Europe overview' })).toBeVisible();
});

test('pins Segment metadata from the route layer', async ({ page }) => {
  const route = page.locator('[data-segment-id]').first();
  await route.focus();
  await route.press('Enter');

  const details = page.getByRole('region', { name: 'Segment details' });
  await expect(details).toBeVisible();
  await expect(details).toContainText('Segment fare (excluding transfers)');
  await details.getByRole('button', { name: 'Close segment details' }).click();
  await expect(details).toBeHidden();
});

test('switches Expense analyses and exposes interactive metadata', async ({ page }) => {
  await page.getByRole('link', { name: 'Expense' }).click();
  await expect(page).toHaveURL(/\?view=expense/);
  await expect(page.getByRole('tabpanel', { name: 'Transportation' })).toBeVisible();

  const transportationBars = page.getByRole('list', { name: 'Transportation barplot' });
  await transportationBars.getByRole('button').first().hover();
  await expect(page.getByText('Base Segment')).toBeVisible();
  await expect(page.getByText('Selected Segment')).toHaveCount(0);

  await page.getByRole('tab', { name: 'Accommodation' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Accommodation' })).toBeVisible();
  const airport = page.getByRole('group', { name: 'Accommodation categories' })
    .getByRole('button', { name: /Airport/ });
  await expect(airport).toHaveAttribute('aria-pressed', 'false');
  await airport.click();
  await expect(airport).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('list', { name: 'Accommodation barplot' })).toContainText('Airport');
});
