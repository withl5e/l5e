import { expect, test } from '@playwright/test';
import { I18N_BASE_URL } from '../playwright.config';

test.use({ baseURL: I18N_BASE_URL });

// examples/i18n's home view renders <ClientIsland from="./react/LocaleCounter"> twice:
//   - .ssr-island : ssr={true}  → server-rendered into the placeholder + hydrated
//   - .csr-island : default     → empty placeholder, client-only mount
// These tests verify the React mechanics specifically (not locale content, covered by
// i18n.spec.ts): raw SSR HTML before any JS runs, hydration onto the *same* DOM (not a
// fresh remount), no React warnings/errors, real useState behavior across several
// clicks, and that the two islands are independent component instances.

test.describe('React islands (SSR + CSR) — mechanics', () => {
  test('raw HTML: ssr island is server-rendered, csr island is an empty placeholder', async ({
    request,
  }) => {
    const response = await request.get('/vi/');
    expect(response.status()).toBe(200);
    const html = await response.text();

    const ssr = html.match(/<div[^>]*\bclass="[^"]*\bssr-island\b[^"]*"[^>]*>(.*?)<\/div><h2>/s);
    expect(ssr, 'ssr-island element present').toBeTruthy();
    expect(ssr![0], 'ssr island carries the SSR marker').toContain('data-island-ssr="1"');
    expect(ssr![1], 'ssr island body has server-rendered React output').toContain(
      'data-testid="ssr-island-count"',
    );
    expect(ssr![1], 'ssr island rendered the initial count').toContain('Đếm: 5');

    const csr = html.match(/<div[^>]*\bclass="[^"]*\bcsr-island\b[^"]*"[^>]*>(.*?)<\/div>/s);
    expect(csr, 'csr-island element present').toBeTruthy();
    expect(csr![0], 'csr island has no SSR marker').not.toContain('data-island-ssr');
    expect(csr![1].trim(), 'csr island body is empty before any client JS runs').toBe('');
  });

  test('no React warnings or errors during load or interaction', async ({ page }) => {
    const consoleIssues: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') consoleIssues.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/vi/');
    await page.locator('.ssr-island button').click();
    await page.locator('.csr-island button').click();
    await page.waitForTimeout(200);

    expect(pageErrors, `unexpected page errors: ${pageErrors.join('; ')}`).toEqual([]);
    const reactIssues = consoleIssues.filter((t) => /react|hydrat/i.test(t));
    expect(reactIssues, `React-related console issues: ${reactIssues.join('; ')}`).toEqual([]);
  });

  test('ssr island hydrates the existing server DOM (state continues, not remounted)', async ({
    page,
  }) => {
    await page.goto('/vi/');
    const count = page.getByTestId('ssr-island-count');
    const button = page.locator('.ssr-island button');

    await expect(count).toContainText('Đếm: 5');
    await button.click();
    await expect(count).toContainText('Đếm: 6');
    await button.click();
    await button.click();
    // If hydration had instead thrown away the server DOM and remounted fresh, this
    // would read 2 (starting over from initCount) instead of continuing from 5.
    await expect(count).toContainText('Đếm: 8');
  });

  test('csr island mounts its own independent useState, starting fresh at 0', async ({
    page,
  }) => {
    await page.goto('/');
    const count = page.getByTestId('csr-island-count');
    const button = page.locator('.csr-island button');

    await expect(count).toContainText('Count: 0');
    await button.click();
    await button.click();
    await button.click();
    await expect(count).toContainText('Count: 3');
  });

  test('ssr and csr islands are independent component instances (clicking one does not affect the other)', async ({
    page,
  }) => {
    await page.goto('/vi/');
    const ssrCount = page.getByTestId('ssr-island-count');
    const csrCount = page.getByTestId('csr-island-count');

    await expect(ssrCount).toContainText('Đếm: 5');
    await expect(csrCount).toContainText('Đếm: 0');

    await page.locator('.ssr-island button').click();
    await expect(ssrCount).toContainText('Đếm: 6');
    await expect(csrCount).toContainText('Đếm: 0'); // unchanged

    await page.locator('.csr-island button').click();
    await expect(csrCount).toContainText('Đếm: 1');
    await expect(ssrCount).toContainText('Đếm: 6'); // unchanged
  });
});
