import { expect, test } from '@playwright/test';

// Replicates packages/core/src/core/server.ts -> hashTag() so we can assert the
// production-hashed cache tag without depending on a private helper export.
function hashTag(tag: string): string {
  if (tag === 'global') return 'global';
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    const char = tag.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).substring(0, 8);
}

test.describe('Loader cache headers (production)', () => {
  test('GET / sets Cache-Control from loader and Cache-Tag includes global + hashed home', async ({
    request,
  }) => {
    const response = await request.get('/');
    expect(response.status()).toBe(200);

    const headers = response.headers();

    const cacheControl = headers['cache-control'];
    expect(cacheControl, 'Cache-Control header should be present in production').toBeTruthy();
    expect(cacheControl).toContain('public');
    expect(cacheControl).toContain('max-age=0');
    expect(cacheControl).toContain('s-maxage=60');
    expect(cacheControl).toContain('stale-while-revalidate=300');

    const cacheTag = headers['cache-tag'];
    expect(cacheTag, 'Cache-Tag header should be set').toBeTruthy();
    const tags = (cacheTag ?? '').split(',').map((t) => t.trim());
    expect(tags).toContain('global');
    // 'home' is hashed in production (optimizeCacheTags). 'global' is passed through.
    expect(tags).toContain(hashTag('home'));
  });
});
