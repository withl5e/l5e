import { parseCookies } from '../core/request';
import { defineMiddleware } from './defineMiddleware';
import type { MiddlewareContext, MiddlewareHandler, RewritePayload } from './types';

// From SvelteKit via Astro: compose middleware handlers in declaration order.
export function sequence(...handlers: Array<MiddlewareHandler | false | null | undefined>) {
  const filtered = handlers.filter(Boolean) as MiddlewareHandler[];
  const length = filtered.length;

  if (!length) {
    return defineMiddleware((_context, next) => {
      return next();
    });
  }

  return defineMiddleware((context, next) => {
    let carriedPayload: RewritePayload | undefined;
    return applyHandle(0, context);

    function applyHandle(
      i: number,
      handleContext: MiddlewareContext,
    ): Promise<Response> | Response {
      const handle = filtered[i];

      return handle(handleContext, async (payload?: RewritePayload) => {
        if (i < length - 1) {
          if (payload) {
            carriedPayload = payload;
            updateContextForRewrite(handleContext, payload);
          }
          return applyHandle(i + 1, handleContext);
        }

        return next(payload ?? carriedPayload);
      });
    }
  });
}

function updateContextForRewrite(context: MiddlewareContext, payload: RewritePayload): void {
  let request: Request;

  if (payload instanceof Request) {
    request = payload;
  } else if (payload instanceof URL) {
    request = new Request(payload.href, context.request.clone());
  } else {
    request = new Request(new URL(payload, context.url).href, context.request.clone());
  }

  const previousUrl = context.url;
  const nextUrl = new URL(request.url);
  const nextCookies = parseCookies(request.headers.get('cookie') ?? undefined);
  context.request = request;
  context.url = nextUrl;
  context.cookies = nextCookies;

  if (context.requestInfo) {
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    context.requestInfo = {
      ...context.requestInfo,
      url: nextUrl,
      path: getRequestInfoPath(nextUrl, previousUrl, context.requestInfo.path),
      pathname: nextUrl.pathname,
      method: request.method,
      headers,
      cookies: nextCookies,
      query: Object.fromEntries(nextUrl.searchParams.entries()),
    };
  }
}

function getRequestInfoPath(nextUrl: URL, previousUrl: URL, previousPath?: string): string {
  const nextPath = `${nextUrl.pathname}${nextUrl.search}` || '/';
  if (!previousPath) {
    return nextPath;
  }

  const previousPathname = previousPath.split('?')[0] || '/';
  if (
    previousPathname === previousUrl.pathname ||
    !previousUrl.pathname.endsWith(previousPathname)
  ) {
    return nextPath;
  }

  const basePathname = previousUrl.pathname.slice(
    0,
    previousUrl.pathname.length - previousPathname.length,
  );
  if (!basePathname || !nextUrl.pathname.startsWith(basePathname)) {
    return nextPath;
  }

  const strippedPathname = nextUrl.pathname.slice(basePathname.length) || '/';
  const normalizedPathname = strippedPathname.startsWith('/')
    ? strippedPathname
    : `/${strippedPathname}`;
  return `${normalizedPathname}${nextUrl.search}`;
}
