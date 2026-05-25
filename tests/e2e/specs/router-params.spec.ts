import { expect, test } from '@playwright/test';

test.describe('Router: defineRoutes params end-to-end', () => {
  test('dynamic $slug reaches loader props and useRequest()', async ({ page, request }) => {
    const response = await request.get('/blog/hello-world');
    expect(response.status()).toBe(200);

    await page.goto('/blog/hello-world');
    await expect(page.getByTestId('slug-loader')).toHaveText('hello-world');
    await expect(page.getByTestId('slug-hook')).toHaveText('hello-world');
  });

  test('URL-encoded $slug is decoded before reaching the view', async ({ page }) => {
    await page.goto('/blog/hello%20world');
    await expect(page.getByTestId('slug-loader')).toHaveText('hello world');
  });

  test('splat captures remaining path into _splat', async ({ page }) => {
    await page.goto('/docs/getting-started/install');
    await expect(page.getByTestId('splat')).toHaveText('getting-started/install');
  });

  test('bare /docs does not match /docs/$ (returns 404)', async ({ request }) => {
    const response = await request.get('/docs');
    expect(response.status()).toBe(404);
  });

  test('static / still works (backward compat)', async ({ request }) => {
    const response = await request.get('/');
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain('<h1>L5E basic example</h1>');
  });

  test('static /actions still works', async ({ request }) => {
    const response = await request.get('/actions');
    expect(response.status()).toBe(200);
  });
});
