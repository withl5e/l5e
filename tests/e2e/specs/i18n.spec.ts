import { expect, test } from '@playwright/test';
import { I18N_BASE_URL } from '../playwright.config';

test.use({ baseURL: I18N_BASE_URL });

test.describe('i18n: fromFetchMiddleware + Paraglide JS (real browser)', () => {
  test('base locale renders English, with correct <html lang>', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByTestId('current-locale')).toHaveText('Current locale: en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hello from L5E!');

    // Deeply nested component — no locale prop was passed to it — proves
    // getLocale() is ambient, not threaded down from the loader.
    await expect(page.getByTestId('locale-badge')).toHaveText(
      'Locale seen deep in the tree (no prop-drilling): en',
    );
  });

  test('clicking the language switcher navigates to /vi/ and renders Vietnamese', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('switch-vi').click();

    await expect(page).toHaveURL(/\/vi\/?$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
    await expect(page.getByTestId('current-locale')).toHaveText('Current locale: vi');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Xin chào từ L5E!');
    await expect(page.getByTestId('locale-badge')).toContainText('vi');
  });

  test('page navigation always follows the URL over a previously-set cookie (no redirect ping-pong)', async ({
    page,
  }) => {
    await page.goto('/vi/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi');

    // Client-side getLocale() (called once in home/client.ts) just synced the
    // DEMO_LOCALE cookie to 'vi'. Navigating back to the bare, unprefixed URL
    // must still render the base locale — 'url' comes first in the strategy
    // list, so it wins over the cookie for page navigation. (Putting 'cookie'
    // first instead causes exactly the redirect loop this test guards against:
    // an explicit navigation to a non-base locale would immediately bounce
    // back because of the stale cookie from the page just left.)
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('non-navigable endpoints (server action) follow the cookie independent of the current page', async ({
    page,
    context,
  }) => {
    await page.goto('/'); // base-locale page; client-side getLocale() syncs cookie to 'en' on load
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    // Overwrite the cookie without reloading the page, so the page's own
    // client-side getLocale() (which re-syncs the cookie to the *page's*
    // locale on every load) doesn't get a chance to overwrite it back.
    await context.addCookies([{ name: 'DEMO_LOCALE', value: 'vi', url: I18N_BASE_URL }]);

    // The action endpoint has no locale-prefixed URL of its own, so
    // routeStrategies (vite.config.js) opts it out of the 'url' strategy —
    // only 'cookie' decides, which is why it reflects 'vi' even though the
    // page itself is still showing the base locale.
    await page.getByTestId('load-greeting-button').click();
    await expect(page.getByTestId('action-result')).toHaveText(
      'Server action trả về đúng locale: vi',
    );
  });

  test('server action reflects the same locale as the page that called it', async ({ page }) => {
    await page.goto('/vi/');
    await page.getByTestId('load-greeting-button').click();

    await expect(page.getByTestId('action-result')).toHaveText(
      'Server action trả về đúng locale: vi',
    );
  });

  test('server action reflects English on the base-locale page', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('load-greeting-button').click();

    await expect(page.getByTestId('action-result')).toHaveText(
      'Server action responded in locale: en',
    );
  });

  test('tooltip fetch carries a real locale prefix (CDN-cacheable per locale) and content matches', async ({
    page,
  }) => {
    await page.goto('/vi/');

    const tooltipRequest = page.waitForRequest((req) => req.url().includes('/tooltip/'));
    await page.getByTestId('tooltip-trigger').hover();
    const request = await tooltipRequest;

    // data-tooltip-base (set from getLocale() in the view) makes this a real,
    // distinct URL per locale — not a single URL that varies by cookie/header,
    // which most CDNs can't cache correctly.
    expect(new URL(request.url()).pathname).toBe('/vi/tooltip/demo/1');

    const tooltip = page.locator('.tp');
    await expect(tooltip).toBeVisible();
    await expect(tooltip.getByTestId('tooltip-content')).toContainText(
      'Fragment tooltip render đúng locale: vi',
    );
  });

  test('tooltip fetch on the base-locale page hits the unprefixed URL', async ({ page }) => {
    await page.goto('/');

    const tooltipRequest = page.waitForRequest((req) => req.url().includes('/tooltip/'));
    await page.getByTestId('tooltip-trigger').hover();
    const request = await tooltipRequest;

    expect(new URL(request.url()).pathname).toBe('/tooltip/demo/1');
    await expect(page.locator('.tp').getByTestId('tooltip-content')).toContainText(
      'Tooltip fragment rendered in locale: en',
    );
  });

  test('loader reads requestInfo directly and does not need to return lang (global-loader.ts owns it)', async ({
    page,
  }) => {
    await page.goto('/vi/');
    // requestInfo.pathname reflects the de-localized path the router sees
    // (Paraglide strips the /vi prefix before l5e's own router runs) — the
    // view's own loader never touched `lang`; global-loader.ts set it.
    await expect(page.getByTestId('current-pathname')).toHaveText(
      'Pathname (from requestInfo): /',
    );
    await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  });

  test('generateMetadata produces a locale-aware <title>', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Hello from L5E!');

    await page.goto('/vi/');
    await expect(page).toHaveTitle('Xin chào từ L5E!');
  });

  test('generateSchema emits locale-aware JSON-LD (inLanguage)', async ({ page }) => {
    await page.goto('/vi/');
    const schemaText = await page.locator('script[type="application/ld+json"]').textContent();
    const schema = JSON.parse(schemaText ?? '{}');

    expect(schema['@type']).toBe('WebSite');
    expect(schema.inLanguage).toBe('vi-VN');
    expect(schema.name).toBe('Xin chào từ L5E!');
  });

  test('React SSR island: server-rendered count survives hydration and increments, locale-aware', async ({
    page,
  }) => {
    await page.goto('/vi/');

    // Server-rendered value, before any client JS could have run.
    const ssrCount = page.getByTestId('ssr-island-count');
    await expect(ssrCount).toHaveText('Đếm: 5 — locale truyền qua prop: vi');

    // Hydration wires up the click handler onto the *same* server-rendered
    // DOM (not a fresh client-only render) — count continues from 5, not 0.
    await page.locator('.ssr-island button').click();
    await expect(ssrCount).toHaveText('Đếm: 6 — locale truyền qua prop: vi');
  });

  test('React CSR island: mounts fresh at count 0 (client-only), locale-aware', async ({
    page,
  }) => {
    await page.goto('/');

    const csrCount = page.getByTestId('csr-island-count');
    await expect(csrCount).toHaveText('Count: 0 — locale prop: en');

    await page.locator('.csr-island button').click();
    await expect(csrCount).toHaveText('Count: 1 — locale prop: en');
  });

  test('concurrent requests for different locales do not leak into each other', async ({
    browser,
  }) => {
    const [contextEn, contextVi] = await Promise.all([browser.newContext(), browser.newContext()]);
    const [pageEn, pageVi] = await Promise.all([contextEn.newPage(), contextVi.newPage()]);

    try {
      await Promise.all([
        pageEn.goto(`${I18N_BASE_URL}/`),
        pageVi.goto(`${I18N_BASE_URL}/vi/`),
      ]);

      await Promise.all([
        pageEn.getByTestId('load-greeting-button').click(),
        pageVi.getByTestId('load-greeting-button').click(),
      ]);

      await expect(pageEn.getByTestId('action-result')).toHaveText(
        'Server action responded in locale: en',
      );
      await expect(pageVi.getByTestId('action-result')).toHaveText(
        'Server action trả về đúng locale: vi',
      );
    } finally {
      await contextEn.close();
      await contextVi.close();
    }
  });
});
