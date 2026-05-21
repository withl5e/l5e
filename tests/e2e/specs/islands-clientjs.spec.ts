import { expect, test } from '@playwright/test';

// In production the per-view client scripts (registered via useClientJs) are
// merged into a single /bundle-<hash>.js chunk by bundleScripts() in server.ts.
// We assert: (a) such a bundle script tag exists in the HTML, (b) the bundle
// is reachable, and (c) it inlines the client.ts source for /actions so
// data-load-time + server-time selectors are present.
const BUNDLE_OR_VIEW_CHUNK = /\/(?:bundle|assets\/views-actions-client)[-A-Za-z0-9_]*\.js$/;

test.describe('useClientJs / hydration in production HTML', () => {
  test('actions page HTML ships a client bundle script', async ({ request }) => {
    const response = await request.get('/actions');
    expect(response.status()).toBe(200);

    const html = await response.text();

    const scriptSrcMatches = Array.from(
      html.matchAll(/<script[^>]+src="([^"]+)"/g),
      (m) => m[1],
    );
    expect(scriptSrcMatches.length, 'at least one client script tag').toBeGreaterThan(0);

    const hasClientBundle = scriptSrcMatches.some((src) => BUNDLE_OR_VIEW_CHUNK.test(src));
    expect(
      hasClientBundle,
      `expected a bundle-*.js or views-actions-client-*.js chunk; got: ${scriptSrcMatches.join(', ')}`,
    ).toBe(true);
  });

  test('client bundle is reachable and contains swap runtime selectors', async ({ request }) => {
    const pageHtml = await (await request.get('/actions')).text();
    const scriptSrcMatches = Array.from(
      pageHtml.matchAll(/<script[^>]+src="([^"]+)"/g),
      (m) => m[1],
    );
    const chunkUrl = scriptSrcMatches.find((src) => BUNDLE_OR_VIEW_CHUNK.test(src));
    expect(chunkUrl, `no bundle chunk in: ${scriptSrcMatches.join(', ')}`).toBeTruthy();

    const chunkResp = await request.get(chunkUrl!);
    expect(chunkResp.status()).toBe(200);
    const code = await chunkResp.text();
    expect(code, 'bundle should include data-load-time selector from client.ts').toMatch(
      /data-load-time/,
    );
    expect(code, 'bundle should include server-time swap target from client.ts').toMatch(
      /server-time/,
    );
  });
});
