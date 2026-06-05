import { parseCookies } from '../core/request';
import { defineMiddleware } from './defineMiddleware';
import { sequence } from './sequence';
import type { CreateContext, MiddlewareContext, RewritePayload } from './types';

export type {
  CreateContext,
  MiddlewareContext,
  MiddlewareHandler,
  MiddlewareNext,
  RewritePayload,
} from './types';

export { defineMiddleware, sequence };

export function createContext({
  request,
  requestInfo,
  locals = {},
  clientAddress,
}: CreateContext): MiddlewareContext {
  const context = {
    cookies: parseCookies(request.headers.get('cookie') ?? undefined),
    request,
    requestInfo,
    url: new URL(request.url),
    redirect(path: string | URL, status = 302) {
      return new Response(null, {
        status,
        headers: {
          Location: path.toString(),
        },
      });
    },
    rewrite(payload: RewritePayload) {
      return Promise.resolve(new Response(null));
    },
    get clientAddress() {
      if (clientAddress) {
        return clientAddress;
      }
      throw new Error('clientAddress is not available for this request.');
    },
  } as Omit<MiddlewareContext, 'locals'> & {
    locals: Record<string, unknown>;
  };

  Object.defineProperty(context, 'locals', {
    enumerable: true,
    get() {
      if (typeof locals !== 'object' || locals === null || Array.isArray(locals)) {
        throw new Error('Middleware locals must be a plain object.');
      }
      return locals;
    },
    set() {
      throw new Error('Middleware locals cannot be reassigned. Mutate its properties instead.');
    },
  });

  context.rewrite = (payload: RewritePayload) => {
    return Promise.resolve(
      new Response(null, {
        status: 307,
        headers: {
          'X-L5E-Rewrite': stringifyRewritePayload(payload, context.url),
        },
      }),
    );
  };

  return context;
}

function stringifyRewritePayload(payload: RewritePayload, currentUrl: URL): string {
  if (payload instanceof Request) {
    return payload.url;
  }

  if (payload instanceof URL) {
    return payload.href;
  }

  return new URL(payload, currentUrl).href;
}
