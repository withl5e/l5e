import { expect, test } from '@playwright/test';

// Runtime bundling happens on the request path, so several requests can race to
// build the same chunk. bundleScripts()/bundleCss() dedupe those into a single
// Rolldown run and keep no temp files on disk; these specs assert the observable
// contract: concurrent requests agree on one bundle URL, that URL serves, and
// an unknown bundle URL 404s instead of being cached as immutable.
const ASSET_TAG = /<(?:script[^>]+src|link[^>]+href)="([^"]+)"/g;

function bundleUrls(html: string): string[] {
  return Array.from(html.matchAll(ASSET_TAG), (m) => m[1]).filter((src) =>
    /\/bundle-[-A-Za-z0-9_]+\.(?:js|css)$/.test(src),
  );
}

test.describe('concurrent runtime bundling', () => {
  test('parallel requests to one page agree on the same bundle URLs', async ({ request }) => {
    const responses = await Promise.all(
      Array.from({ length: 20 }, () => request.get('/actions')),
    );

    for (const response of responses) {
      expect(response.status()).toBe(200);
    }

    const perResponse = await Promise.all(responses.map((r) => r.text().then(bundleUrls)));

    const [first] = perResponse;
    expect(first.length, 'the actions page should ship at least one bundle').toBeGreaterThan(0);
    for (const urls of perResponse) {
      expect(urls).toEqual(first);
    }
  });

  test('bundles built under parallel load are all served', async ({ request }) => {
    const pages = ['/', '/actions', '/island', '/blog', '/docs'];

    // Hit distinct pages at once so several different bundles build concurrently.
    const pageHtml = await Promise.all(
      pages.flatMap((p) => [
        request.get(p).then((r) => r.text()),
        request.get(p).then((r) => r.text()),
      ]),
    );

    const urls = [...new Set(pageHtml.flatMap(bundleUrls))];
    expect(urls.length, 'expected runtime bundles across these pages').toBeGreaterThan(0);

    for (const url of urls) {
      const response = await request.get(url);
      expect(response.status(), `${url} should be served from the bundle map`).toBe(200);
      expect((await response.text()).length, `${url} should not be empty`).toBeGreaterThan(0);
    }
  });
});

test.describe('unknown bundle URLs', () => {
  // Bundles live in an in-memory map, so a hash the server never built — a stale
  // URL from a previous process, or a hand-crafted one — has no file to fall
  // back to on disk.
  for (const url of ['/bundle-0123456789abcdef.js', '/bundle-0123456789abcdef.css']) {
    test(`${url} returns 404`, async ({ request }) => {
      const response = await request.get(url);

      expect(response.status()).toBe(404);
      expect(await response.text()).toContain('Bundled file not found');
    });

    test(`${url} is not cached as immutable`, async ({ request }) => {
      const response = await request.get(url);

      // Caching a miss under the immutable asset policy would pin the 404 in
      // shared caches long after the bundle exists again.
      expect(response.headers()['cache-control'] ?? '').not.toContain('immutable');
    });
  }
});
