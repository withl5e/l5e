import { expect, test } from '@playwright/test';

test.describe('SSR + SEO meta', () => {
  test('GET / returns fully-rendered HTML with title, description, h1 and timestamp before any client JS', async ({
    request,
  }) => {
    const response = await request.get('/');
    expect(response.status()).toBe(200);

    const contentType = response.headers()['content-type'] || '';
    expect(contentType).toMatch(/text\/html/);

    const html = await response.text();

    expect(html).toContain('<title>L5E basic example</title>');
    expect(html).toMatch(
      /<meta\s+name="description"\s+content="A minimal L5E app with middleware rewrite and cache headers\."\s*\/?>/,
    );

    expect(html).toContain('<h1>L5E basic example</h1>');
    expect(html).toContain('This page is server-rendered.');

    expect(html).toMatch(
      /Rendered at\s*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/,
    );
  });

  test('GET /actions ships title from view loader.generateMetadata', async ({ request }) => {
    const response = await request.get('/actions');
    expect(response.status()).toBe(200);

    const html = await response.text();
    expect(html).toContain('<title>Action + swap example</title>');
    expect(html).toContain('<h1>Action + swap</h1>');
    expect(html).toContain('data-swap-target="server-time"');
  });
});
