import type { RequestInfo } from '@l5e/core/entry-server';

export default function routeHandler(requestInfo: RequestInfo) {
  if (requestInfo.pathname === '/') return 'home';
  return null;
}
