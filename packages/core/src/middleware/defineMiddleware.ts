import type { MiddlewareHandler } from './types';

export function defineMiddleware(fn: MiddlewareHandler): MiddlewareHandler {
  return fn;
}
