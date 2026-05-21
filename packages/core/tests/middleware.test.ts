import { describe, expect, it } from 'vitest';
import {
  createContext,
  defineMiddleware,
  isLocalsSerializable,
  sequence,
  trySerializeLocals,
} from '../src/middleware';

describe('middleware', () => {
  it('defineMiddleware returns the handler unchanged', () => {
    const handler = defineMiddleware((_context, next) => next());
    expect(defineMiddleware(handler)).toBe(handler);
  });

  it('runs sequence handlers in order and lets them modify the response', async () => {
    const calls: string[] = [];
    const context = createContext({
      request: new Request('https://example.com/a'),
      locals: {},
    });

    const handler = sequence(
      defineMiddleware(async (ctx, next) => {
        calls.push('a:before');
        ctx.locals.a = true;
        const response = await next();
        response.headers.set('x-a', '1');
        calls.push('a:after');
        return response;
      }),
      defineMiddleware(async (ctx, next) => {
        calls.push('b:before');
        expect(ctx.locals.a).toBe(true);
        const response = await next();
        response.headers.set('x-b', '1');
        calls.push('b:after');
        return response;
      }),
    );

    const response = await handler(context, async () => {
      calls.push('final');
      return new Response('ok');
    });

    expect(await response.text()).toBe('ok');
    expect(response.headers.get('x-a')).toBe('1');
    expect(response.headers.get('x-b')).toBe('1');
    expect(calls).toEqual(['a:before', 'b:before', 'final', 'b:after', 'a:after']);
  });

  it('short-circuits when a handler does not call next', async () => {
    const context = createContext({
      request: new Request('https://example.com/a'),
      locals: {},
    });
    const handler = sequence(
      defineMiddleware(() => new Response('blocked', { status: 403 })),
      defineMiddleware(() => new Response('unreachable')),
    );

    const response = await handler(context, async () => new Response('final'));

    expect(response.status).toBe(403);
    expect(await response.text()).toBe('blocked');
  });

  it('carries rewrite payloads through sequence', async () => {
    const originalUrl = new URL('https://example.com/original');
    const context = createContext({
      request: new Request(originalUrl),
      requestInfo: {
        url: originalUrl,
        path: '/original',
        pathname: '/original',
        query: {},
        cookies: {},
      },
      locals: {},
    });

    const handler = sequence(
      defineMiddleware((_ctx, next) => next('/rewritten?x=1')),
      defineMiddleware((ctx, next) => {
        expect(ctx.url.pathname).toBe('/rewritten');
        expect(ctx.url.searchParams.get('x')).toBe('1');
        expect(ctx.requestInfo?.url?.pathname).toBe('/rewritten');
        expect(ctx.requestInfo?.pathname).toBe('/rewritten');
        expect(ctx.requestInfo?.path).toBe('/rewritten?x=1');
        expect(ctx.requestInfo?.query).toEqual({ x: '1' });
        return next();
      }),
    );

    const response = await handler(context, async (payload) => {
      expect(payload).toBe('/rewritten?x=1');
      return new Response(context.url.pathname);
    });

    expect(await response.text()).toBe('/rewritten');
  });

  it('serializes only JSON-safe locals', () => {
    expect(isLocalsSerializable({ user: { id: '1' }, flags: [true, false] })).toBe(true);
    expect(trySerializeLocals({ ok: true })).toBe('{"ok":true}');
    expect(isLocalsSerializable({ createdAt: new Date() })).toBe(false);
    expect(() => trySerializeLocals({ map: new Map() })).toThrow(
      "The passed value can't be serialized.",
    );
  });

  it('prevents locals reassignment', () => {
    const context = createContext({
      request: new Request('https://example.com/a'),
      locals: {},
    });

    expect(() => {
      (context as any).locals = {};
    }).toThrow('Middleware locals cannot be reassigned.');
  });
});
