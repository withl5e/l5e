import type { RequestInfo } from '@withl5e/l5e/entry-server';

export default function routeHandler(requestInfo: RequestInfo) {
  const { pathname } = requestInfo;
  if (pathname === '/favicon.ico') return null;
  if (pathname === '/') return 'home';
  if (pathname === '/docs' || pathname.startsWith('/docs/')) return 'docs';
  return null;
}
