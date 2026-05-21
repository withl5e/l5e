import type { RequestInfo } from '@withl5e/l5e/entry-server';

export default function routeHandler(requestInfo: RequestInfo) {
  if (requestInfo.pathname === '/') return 'home';
  if (requestInfo.pathname === '/actions') return 'actions';
  return null;
}
