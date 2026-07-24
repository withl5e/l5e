import { describe, expect, it } from 'vitest';
import { createContext, sequence } from '../src/middleware';
import { fromFetchMiddleware } from '../src/i18n/middleware';
import type { FetchLocaleMiddleware } from '../src/i18n/types';

/** Minimal fake standing in for a real library like Paraglide's `paraglideMiddleware`. */
const urlPrefixMiddleware: FetchLocaleMiddleware<'vi' | 'en'> = (request, resolve) => {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/en')) {
    const rest = url.pathname.slice('/en'.length) || '/';
    const delocalized = new URL(rest.startsWith('/') ? rest : `/${rest}`, url);
    return resolve({ request: new Request(delocalized, request), locale: 'en' });
  }
  return resolve({ request, locale: 'vi' });
};

describe('fromFetchMiddleware', () => {
  it('writes the resolved locale onto context.locals and forwards the (possibly rewritten) request to next()', async () => {
    const context = createContext({
      request: new Request('https://example.com/en/about'),
      locals: {},
    });

    const handler = sequence(fromFetchMiddleware(urlPrefixMiddleware));

    let forwardedPathname: string | undefined;
    await handler(context, async (payload) => {
      forwardedPathname = payload instanceof Request ? new URL(payload.url).pathname : undefined;
      return new Response('ok');
    });

    expect(context.locals.locale).toBe('en');
    expect(forwardedPathname).toBe('/about');
  });

  it('resolves the base locale for an unprefixed URL', async () => {
    const context = createContext({
      request: new Request('https://example.com/about'),
      locals: {},
    });

    const handler = sequence(fromFetchMiddleware(urlPrefixMiddleware));
    await handler(context, async () => new Response('ok'));

    expect(context.locals.locale).toBe('vi');
  });

  it('honors a short-circuit: locals is left untouched and the library response wins', async () => {
    const redirecting: FetchLocaleMiddleware = () => new Response(null, { status: 307 });

    const context = createContext({
      request: new Request('https://example.com/fr/about'),
      locals: {},
    });

    const handler = sequence(fromFetchMiddleware(redirecting));
    const response = await handler(context, async () => new Response('should not run'));

    expect(response.status).toBe(307);
    expect(context.locals.locale).toBeUndefined();
  });

  it('forwards the options argument through to the wrapped middleware', async () => {
    let receivedOptions: unknown;
    const middleware: FetchLocaleMiddleware<string, { tag: string }> = (request, resolve, options) => {
      receivedOptions = options;
      return resolve({ request, locale: 'vi' });
    };

    const context = createContext({
      request: new Request('https://example.com/'),
      locals: {},
    });

    const handler = sequence(fromFetchMiddleware(middleware, { tag: 'hello' }));
    await handler(context, async () => new Response('ok'));

    expect(receivedOptions).toEqual({ tag: 'hello' });
  });

  it('composes with other middleware in sequence() — locale is visible downstream', async () => {
    const calls: string[] = [];

    const context = createContext({
      request: new Request('https://example.com/en/about'),
      locals: {},
    });

    const handler = sequence(
      fromFetchMiddleware(urlPrefixMiddleware),
      (ctx, next) => {
        calls.push(`locale=${ctx.locals.locale}`);
        return next();
      },
    );

    await handler(context, async () => new Response('ok'));
    expect(calls).toEqual(['locale=en']);
  });

  it("calls next() synchronously inside the library's resolve callback, so the library's own AsyncLocalStorage (e.g. Paraglide's ambient getLocale()) stays active for the rest of the request — no bridging needed", async () => {
    // Stand-in for Paraglide's `serverAsyncLocalStorage` + its ambient `getLocale()`.
    const { AsyncLocalStorage } = await import('node:async_hooks');
    const libraryAls = new AsyncLocalStorage<{ locale: string }>();
    const libraryGetLocale = () => libraryAls.getStore()?.locale;

    const libraryMiddleware: FetchLocaleMiddleware<'en'> = (request, resolve) => {
      return libraryAls.run({ locale: 'en' }, () => resolve({ request, locale: 'en' }));
    };

    const context = createContext({
      request: new Request('https://example.com/'),
      locals: {},
    });

    let localeSeenDownstream: string | undefined;
    const handler = sequence(fromFetchMiddleware(libraryMiddleware));
    await handler(context, async () => {
      // Simulates the rest of l5e's pipeline (route handler, loaders, render)
      // reading the *library's own* getLocale() — not anything l5e provides.
      await Promise.resolve();
      localeSeenDownstream = libraryGetLocale();
      return new Response('ok');
    });

    expect(localeSeenDownstream).toBe('en');
  });
});
