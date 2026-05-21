/**
 * Fetches the GitHub star count for the L5E repo with a module-scoped cache.
 * - TTL: 5 minutes. Stays well inside GitHub's 60 req/hr unauthenticated limit.
 * - Inflight de-dupe: concurrent requests share one fetch.
 * - 3s timeout. On any failure the last-known value is returned (or null on cold cache).
 */

const REPO = 'withl5e/l5e';
const TTL_MS = 60 * 60 * 1000;

let cache: { stars: number; fetchedAt: number } | null = null;
let inflight: Promise<number | null> | null = null;

export function getGitHubStars(): Promise<number | null> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < TTL_MS) {
    return Promise.resolve(cache.stars);
  }
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}`, {
        headers: {
          'User-Agent': 'l5e-docs-site',
          Accept: 'application/vnd.github+json',
        },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) {
        // Rate limited / not found / network — keep the previous value if any.
        return cache?.stars ?? null;
      }
      const data = (await res.json()) as { stargazers_count?: number };
      const stars = typeof data.stargazers_count === 'number' ? data.stargazers_count : null;
      if (stars !== null) {
        cache = { stars, fetchedAt: Date.now() };
      }
      return stars ?? cache?.stars ?? null;
    } catch {
      return cache?.stars ?? null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** GitHub-style number formatter: 999 → "999", 1234 → "1.2k", 12345 → "12k". */
export function formatStarCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  if (n < 1_000_000) return Math.round(n / 1000) + 'k';
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
}
