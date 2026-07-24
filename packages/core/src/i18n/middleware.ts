import { defineMiddleware } from '../middleware/defineMiddleware';
import type { MiddlewareHandler } from '../middleware/types';
import type { FetchLocaleMiddleware } from './types';

/**
 * Adapt a fetch-based locale middleware — e.g. Paraglide's own
 * `paraglideMiddleware` — into an l5e `MiddlewareHandler`.
 *
 * l5e doesn't ship its own locale-detection/URL-localization logic (strip
 * prefix, cookie, redirect) or its own `getLocale()`: libraries like
 * Paraglide already do both well, including an ambient `getLocale()` backed
 * by their own `AsyncLocalStorage`. This adapter is only the bridge — it
 * hands `context.request` to the library's middleware and, once resolved,
 * (1) continues the chain by calling `next(request)` *synchronously inside*
 * the library's own resolve callback, so the library's `AsyncLocalStorage`
 * scope (already wrapping that callback) naturally extends over the rest of
 * the request — loaders, route handler, every component — meaning the
 * library's own `getLocale()` just works, no bridging needed; and (2) writes
 * the resolved locale onto `context.locals.locale` too, since that's the
 * idiomatic place other l5e code (global-loader's `lang`, cache tags, ...)
 * already reads request-scoped values from — see the `locals` docs.
 *
 * @example
 * ```ts
 * // src/middleware.ts
 * import { sequence } from '@withl5e/l5e/middleware';
 * import { fromFetchMiddleware } from '@withl5e/l5e/i18n';
 * import { paraglideMiddleware } from '~/paraglide/server.js';
 *
 * export const onRequest = sequence(fromFetchMiddleware(paraglideMiddleware));
 *
 * // Anywhere in the app — loaders, components, plain utils:
 * import { getLocale } from '~/paraglide/runtime.js'; // Paraglide's own, ambient
 * ```
 */
export function fromFetchMiddleware<TLocale extends string = string, TOptions = unknown>(
  middleware: FetchLocaleMiddleware<TLocale, TOptions>,
  options?: TOptions,
): MiddlewareHandler {
  return defineMiddleware((context, next) => {
    return middleware(
      context.request,
      ({ request, locale }) => {
        context.locals.locale = locale;
        return next(request);
      },
      options,
    );
  });
}
