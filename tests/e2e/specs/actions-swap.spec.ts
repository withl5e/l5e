import { expect, test } from '@playwright/test';

test.describe('Actions + swap (browser, no full reload)', () => {
  test('click [data-load-time] swaps server-time fragment in-place without navigation', async ({
    page,
  }) => {
    let navigationCount = 0;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) navigationCount += 1;
    });

    await page.goto('/actions');
    expect(navigationCount).toBe(1);

    const target = page.locator('[data-swap-target="server-time"]');
    await expect(target).toHaveText('not loaded');

    const actionRequestPromise = page.waitForResponse(
      (resp) => resp.url().includes('/_l5e/action/') && resp.status() === 200,
    );

    await page.locator('[data-load-time]').click();

    const actionResponse = await actionRequestPromise;
    const fragmentHtml = await actionResponse.text();
    expect(fragmentHtml).toMatch(
      /<span data-swap-target="server-time">\s*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\s*<\/span>/,
    );

    await expect(target).toHaveText(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );

    expect(navigationCount, 'no full-page navigation should occur').toBe(1);
  });
});
