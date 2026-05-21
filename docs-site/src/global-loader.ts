import type { LoaderFunction, LoaderResult } from '@withl5e/l5e/entry-server';

import { getGitHubStars } from '~/shared/github-stars';

/**
 * Global loader runs before every view. Used here only to fetch the GitHub
 * star count and stash it in requestInfo.locals so any component can read it
 * via useRequest().locals.githubStars. The fetch is module-scoped + 5min TTL
 * cached, so a real GitHub API call happens at most once every 5 minutes
 * regardless of request volume.
 */
export const loader: LoaderFunction = async (requestInfo): Promise<LoaderResult> => {
  const stars = await getGitHubStars();

  if (!requestInfo.locals) {
    (requestInfo as { locals?: Record<string, unknown> }).locals = {};
  }
  (requestInfo.locals as Record<string, unknown>).githubStars = stars;

  return {
    props: { githubStars: stars },
  };
};

/**
 * Skip the global loader for endpoints that don't ship the main menu —
 * keeps responses for action/sitemap/robots endpoints lean.
 */
export function shouldIgnore(viewName: string): boolean {
  return false;
}
