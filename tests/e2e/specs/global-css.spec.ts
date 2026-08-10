import { expect, test } from '@playwright/test';
import { DEV_BASE_URL } from '../playwright.config';

test.describe('global stylesheet convention in development', () => {
  test.use({ baseURL: DEV_BASE_URL });

  test('emits src/global.css once in head before page styles', async ({ request }) => {
    const response = await request.get('/actions');
    expect(response.status()).toBe(200);
    const html = await response.text();
    const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? '';

    expect(head.split('href="/src/global.css"')).toHaveLength(2);
    expect(head.indexOf('href="/src/global.css"')).toBeLessThan(
      head.indexOf('href="/src/views/actions/actions.css"'),
    );
  });

  test('layout is styled before client.global.ts can execute on navigation', async ({ page }) => {
    await page.goto('/');

    let releaseClientEntry!: () => void;
    const clientEntryCanFinish = new Promise<void>((resolve) => {
      releaseClientEntry = resolve;
    });
    let signalBlocked!: () => void;
    const blockedClientEntry = new Promise<void>((resolve) => {
      signalBlocked = resolve;
    });
    let signalFinished!: () => void;
    const routeFinished = new Promise<void>((resolve) => {
      signalFinished = resolve;
    });

    await page.route('**/src/client.global.ts', async (route) => {
      signalBlocked();
      await clientEntryCanFinish;
      await route.abort();
      signalFinished();
    });

    try {
      await page.locator('a[href="/actions"]').click({ noWaitAfter: true });
      await blockedClientEntry;
      await page.locator('.nav').waitFor({ state: 'attached' });

      expect(
        await page.evaluate(() => ({
          background: getComputedStyle(document.body).backgroundColor,
          bodyMargin: getComputedStyle(document.body).margin,
          navDisplay: getComputedStyle(document.querySelector('.nav')!).display,
        })),
      ).toEqual({
        background: 'rgb(246, 247, 249)',
        bodyMargin: '0px',
        navDisplay: 'flex',
      });
    } finally {
      releaseClientEntry();
      await routeFinished;
    }
  });
});

test('production emits the hashed global stylesheet before page CSS', async ({ request }) => {
  const response = await request.get('/actions');
  expect(response.status()).toBe(200);
  const html = await response.text();
  const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? '';
  const stylesheets = Array.from(
    head.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g),
    (match) => match[1],
  );

  expect(stylesheets[0]).toMatch(/^\/assets\/global-style-.*\.css$/);
  expect(stylesheets.filter((href) => href.includes('global-style-'))).toHaveLength(1);
  expect(head).not.toContain('/src/global.css');
});
