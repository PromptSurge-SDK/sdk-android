import { test, expect } from '@playwright/test';

const timestamp = Date.now();
const email = `e2e+${timestamp}@test.promptsurge.dev`;
const password = 'test-password-e2e';
const appName = `E2E App ${timestamp}`;

test('cold flow: signup → create app → copy key → see events page', async ({ page }) => {
  // ── Signup ────────────────────────────────────────────────────────────────
  await page.goto('/signup');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Should land on /dashboard
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText('Your apps')).toBeVisible();

  // ── Create app ────────────────────────────────────────────────────────────
  await page.click('[data-testid="create-app-btn"]');
  await page.fill('#app-name', appName);
  await page.click('[data-testid="create-app-form"] button[type="submit"]');

  // API key reveal should appear
  const keyEl = page.locator('[data-testid="api-key-value"]');
  await expect(keyEl).toBeVisible({ timeout: 10_000 });
  const keyText = await keyEl.textContent();
  expect(keyText).toMatch(/^ps_live_/);

  // Copy button exists
  await expect(page.locator('[data-testid="copy-key-btn"]')).toBeVisible();

  // ── Confirm saved ─────────────────────────────────────────────────────────
  await page.click('[data-testid="saved-key-checkbox"]');
  await page.click('[data-testid="done-btn"]');

  // Back on dashboard, new app listed
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(appName)).toBeVisible();

  // ── Navigate to app detail ─────────────────────────────────────────────────
  await page.getByText(appName).click();
  await expect(page).toHaveURL(/\/apps\//);
  await expect(page.getByText('Stats')).toBeVisible();
  await expect(page.getByText('API key')).toBeVisible();

  // ── Navigate to events page ────────────────────────────────────────────────
  await page.getByText('View events →').click();
  await expect(page).toHaveURL(/\/events/);
  await expect(page.getByText('Events')).toBeVisible();
  // No events yet — empty state shown
  await expect(page.getByText('No events yet')).toBeVisible();
});

test('protected route redirects to /login when unauthenticated', async ({ page }) => {
  // Clear cookies by using a fresh context (this test runs in its own context)
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('login with existing dev seed account', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'dev@promptsurge.test');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/);
});
