import { expect, test } from '@playwright/test';

test.describe('Middleware: rewrite + addPoweredBy', () => {
  test('GET /rewrite-demo serves home content (rewrite, not redirect) with x-powered-by: L5E', async ({
    request,
  }) => {
    const response = await request.get('/rewrite-demo', { maxRedirects: 0 });

    expect(response.status()).toBe(200);
    expect(response.url()).toBe(new URL('/rewrite-demo', 'http://127.0.0.1:5174').toString());

    expect(response.headers()['x-powered-by']).toBe('L5E');

    const html = await response.text();
    expect(html).toContain('<h1>L5E basic example</h1>');
    expect(html).toContain('This page is server-rendered.');
  });

  test('addPoweredBy applies to / as well', async ({ request }) => {
    const response = await request.get('/');
    expect(response.headers()['x-powered-by']).toBe('L5E');
  });
});
