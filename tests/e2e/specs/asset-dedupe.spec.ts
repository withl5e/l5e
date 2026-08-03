import { expect, test } from '@playwright/test';
import { DEV_BASE_URL } from '../playwright.config';

// /asset-dedupe calls useCss + useClientJs from the page and from a shared card
// component rendered twice — three registrations of the same two files. The
// registry dedupes them, so both dev and production must ship exactly one
// stylesheet tag and one script tag for those assets.
const CSS_PATH = '/src/views/asset-dedupe/asset-dedupe.css';
const JS_PATH = '/src/views/asset-dedupe/client.ts';

test.describe('dev server', () => {
  test.use({ baseURL: DEV_BASE_URL });

  test('emits one <link> and one <script> for a repeatedly registered asset', async ({
    request,
  }) => {
    const response = await request.get('/asset-dedupe');
    expect(response.status()).toBe(200);
    const html = await response.text();

    // Dev serves source paths straight through — no bundling, no hashing.
    expect(html.split(`href="${CSS_PATH}"`).length - 1).toBe(1);
    expect(html.split(`src="${JS_PATH}"`).length - 1).toBe(1);
  });

  test('client js executes once', async ({ page }) => {
    await page.goto('/asset-dedupe');

    await expect(page.locator('[data-dedupe-card]').first()).toHaveText('client js runs: 1');
    expect(await page.evaluate(() => (window as any).__dedupeRuns)).toBe(1);
  });
});

test.describe('production server', () => {
  test('ships a single bundled stylesheet and script', async ({ request }) => {
    const response = await request.get('/asset-dedupe');
    expect(response.status()).toBe(200);
    const html = await response.text();

    const links = Array.from(html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)).map(
      (m) => m[1],
    );
    const bundledCss = links.filter((href) => /\/bundle-[-A-Za-z0-9_]+\.css$/.test(href));
    expect(bundledCss).toHaveLength(1);

    const scripts = Array.from(html.matchAll(/<script[^>]+src="([^"]+)"/g)).map((m) => m[1]);
    const bundledJs = scripts.filter((src) => /\/bundle-[-A-Za-z0-9_]+\.js$/.test(src));
    expect(bundledJs).toHaveLength(1);
  });

  test('client js executes once', async ({ page }) => {
    await page.goto('/asset-dedupe');

    await expect(page.locator('[data-dedupe-card]').first()).toHaveText('client js runs: 1');
  });
});
