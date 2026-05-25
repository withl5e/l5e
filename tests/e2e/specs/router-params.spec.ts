import { expect, test } from '@playwright/test';

test.describe('Router: defineRoutes params end-to-end (path-to-regexp syntax)', () => {
  test(':slug reaches loader props and useRequest()', async ({ page, request }) => {
    const response = await request.get('/blog/hello-world');
    expect(response.status()).toBe(200);

    await page.goto('/blog/hello-world');
    await expect(page.getByTestId('slug-loader')).toHaveText('hello-world');
    await expect(page.getByTestId('slug-hook')).toHaveText('hello-world');
  });

  test('URL-encoded :slug is decoded before reaching the view', async ({ page }) => {
    await page.goto('/blog/hello%20world');
    await expect(page.getByTestId('slug-loader')).toHaveText('hello world');
  });

  test('optional {/page/:page} group absent → loader defaults page to 1', async ({ page }) => {
    await page.goto('/blog/hello-world');
    await expect(page.getByTestId('page')).toHaveText('1');
  });

  test('optional {/page/:page} group present → loader receives page', async ({ page }) => {
    await page.goto('/blog/hello-world/page/2');
    await expect(page.getByTestId('slug-loader')).toHaveText('hello-world');
    await expect(page.getByTestId('page')).toHaveText('2');
  });

  test('partial optional group does not match (404)', async ({ request }) => {
    // /blog/:slug{/page/:page} requires both `page` and the param when the group activates
    const response = await request.get('/blog/hello-world/page');
    expect(response.status()).toBe(404);
  });

  test('over-saturated URL returns 404', async ({ request }) => {
    const response = await request.get('/blog/hello-world/page/2/extra');
    expect(response.status()).toBe(404);
  });

  test('splat *path captures remaining segments as joined string', async ({ page }) => {
    await page.goto('/docs/getting-started/install');
    await expect(page.getByTestId('splat')).toHaveText('getting-started/install');
  });

  test('bare /docs does not match /docs/*path (returns 404)', async ({ request }) => {
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
