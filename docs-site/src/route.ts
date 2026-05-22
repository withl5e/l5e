import type { RequestInfo } from '@withl5e/l5e/entry-server';

export default function routeHandler(requestInfo: RequestInfo) {
  const { pathname } = requestInfo;
  if (!pathname) return null;
  if (pathname === '/favicon.ico') return null;
  if (pathname === '/') return 'home';
  if (pathname === '/sitemap.xml') return 'sitemap';
  if (pathname === '/docs' || pathname.startsWith('/docs/')) return 'docs';
  return null;
}
