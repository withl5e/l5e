import { expect, test } from '@playwright/test';
import { DEV_BASE_URL } from '../playwright.config';

// The /island page (examples/basic) renders two <ClientIsland from="./react/Counter">:
//   - `.ssr-island`  : ssr={true}  → server-rendered into the placeholder + hydrated
//   - `.csr-island`  : default     → empty placeholder, client-only mount
// These tests assert the SSR path produces server HTML in the raw response (before
// any JS runs) and that the client hydrates it (preserving server state), while the
// client-only island stays empty until JS mounts it fresh.

test.describe('ssr islands in production HTML', () => {
  test('raw HTML server-renders the ssr island and skips the client-only one', async ({
    request,
  }) => {
    const response = await request.get('/island');
    expect(response.status()).toBe(200);
    const html = await response.text();

    // SSR island: token normalized to "1" + server-rendered React HTML inlined.
    expect(html, 'ssr island normalizes data-island-ssr to "1"').toContain('data-island-ssr="1"');
    // React SSR splits static/dynamic text with a `<!-- -->` marker: "Count: <!-- -->5".
    expect(html, 'ssr island body has server-rendered count').toMatch(/Count:\s*(?:<!--\s*-->)?\s*5/);

    // Regression guard for the `$`-replacement fix in fillSsrIslands: a buggy
    // String.replace(token, out) would collapse "$$" → "$". The fix keeps it literal.
    expect(html, 'literal "$$" survives the token replacement').toContain('Total: $$42');

    // Client-only island: registered placeholder, but NOT server-rendered.
    const csr = html.match(/<div[^>]*\bclass="[^"]*\bcsr-island\b[^"]*"[^>]*>(.*?)<\/div>/s);
    expect(csr, 'csr-island element present').toBeTruthy();
    expect(csr![0], 'client-only island has no data-island-ssr').not.toContain('data-island-ssr');
    expect(csr![1].trim(), 'client-only island body is empty (no server render)').toBe('');
  });

  test('client hydrates the ssr island, preserving server state', async ({ page }) => {
    await page.goto('/island');

    // Server state (initCount=5) is present immediately and survives hydration.
    const ssrBtn = page.locator('.ssr-island button');
    await expect(page.locator('.ssr-island .count')).toHaveText('Count: 5');

    // Interactivity proves hydration wired the click handler onto the server DOM.
    await ssrBtn.click();
    await expect(page.locator('.ssr-island .count')).toHaveText('Count: 6');
  });

  test('client-only island mounts fresh from initCount=0', async ({ page }) => {
    await page.goto('/island');

    // Starts empty, then the client mounts it at its own initial state.
    await expect(page.locator('.csr-island .count')).toHaveText('Count: 0');
    await page.locator('.csr-island button').click();
    await expect(page.locator('.csr-island .count')).toHaveText('Count: 1');
  });
});

test.describe('islands in development', () => {
  test.use({ baseURL: DEV_BASE_URL });

  test('hydrates without loading server-only render context code in the browser', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/island');

    const ssrCount = page.locator('.ssr-island .count');
    await expect(ssrCount).toHaveText('Count: 5');
    const csrCount = page.locator('.csr-island .count');
    await expect(csrCount).toHaveText('Count: 0');
    await page.locator('.ssr-island button').click();
    await expect(ssrCount).toHaveText('Count: 6');

    await page.locator('.csr-island button').click();
    await expect(csrCount).toHaveText('Count: 1');

    expect(pageErrors).toEqual([]);
  });
});
