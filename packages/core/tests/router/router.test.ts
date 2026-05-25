import { describe, expect, it } from 'vitest';
import { BadRequestException, RedirectException } from '../../src/core/exceptions';
import type { RequestInfo } from '../../src/core/entry-server';
import { defineRoutes } from '../../src/router';

function req(pathname: string): RequestInfo {
  return { pathname };
}

describe('defineRoutes — static matching', () => {
  it('matches the root path', async () => {
    const handler = defineRoutes([{ path: '/', view: 'home' }]);
    expect(await handler(req('/'))).toEqual({ view: 'home', params: {} });
  });

  it('matches an exact static path', async () => {
    const handler = defineRoutes([
      { path: '/', view: 'home' },
      { path: '/about', view: 'about' },
    ]);
    expect(await handler(req('/about'))).toEqual({ view: 'about', params: {} });
  });

  it('returns null when no route matches', async () => {
    const handler = defineRoutes([{ path: '/', view: 'home' }]);
    expect(await handler(req('/missing'))).toBeNull();
  });
});

describe('defineRoutes — dynamic params', () => {
  it('extracts single dynamic segment', async () => {
    const handler = defineRoutes([{ path: '/blog/$slug', view: 'article' }]);
    const result = await handler(req('/blog/hello-world'));
    expect(result).toEqual({ view: 'article', params: { slug: 'hello-world' } });
  });

  it('extracts multiple dynamic segments', async () => {
    const handler = defineRoutes([
      { path: '/users/$userId/posts/$postId', view: 'post' },
    ]);
    const result = await handler(req('/users/u1/posts/p2'));
    expect(result).toEqual({
      view: 'post',
      params: { userId: 'u1', postId: 'p2' },
    });
  });

  it('decodes URL-encoded params', async () => {
    const handler = defineRoutes([{ path: '/blog/$slug', view: 'article' }]);
    const result = await handler(req('/blog/hello%20world'));
    expect(result).toEqual({ view: 'article', params: { slug: 'hello world' } });
  });
});

describe('defineRoutes — splat', () => {
  it('captures remaining path into _splat', async () => {
    const handler = defineRoutes([{ path: '/docs/$', view: 'docs' }]);
    const result = await handler(req('/docs/getting-started/install'));
    expect(result).toEqual({
      view: 'docs',
      params: { _splat: 'getting-started/install' },
    });
  });

  it('does not match the bare parent path', async () => {
    const handler = defineRoutes([{ path: '/docs/$', view: 'docs' }]);
    expect(await handler(req('/docs'))).toBeNull();
  });

  it('decodes each splat segment', async () => {
    const handler = defineRoutes([{ path: '/files/$', view: 'files' }]);
    const result = await handler(req('/files/a%20b/c%20d'));
    expect(result).toEqual({
      view: 'files',
      params: { _splat: 'a b/c d' },
    });
  });
});

describe('defineRoutes — priority', () => {
  it('static segment beats dynamic at same depth regardless of declaration order', async () => {
    const a = defineRoutes([
      { path: '/docs/$slug', view: 'doc-page' },
      { path: '/docs/api', view: 'api-docs' },
    ]);
    expect(await a(req('/docs/api'))).toEqual({ view: 'api-docs', params: {} });
    expect(await a(req('/docs/intro'))).toEqual({
      view: 'doc-page',
      params: { slug: 'intro' },
    });

    const b = defineRoutes([
      { path: '/docs/api', view: 'api-docs' },
      { path: '/docs/$slug', view: 'doc-page' },
    ]);
    expect(await b(req('/docs/api'))).toEqual({ view: 'api-docs', params: {} });
  });

  it('static-only route beats dynamic, dynamic beats splat', async () => {
    const handler = defineRoutes([
      { path: '/docs/$', view: 'docs-splat' },
      { path: '/docs/$slug', view: 'doc-page' },
      { path: '/docs/api', view: 'api-docs' },
    ]);
    expect((await handler(req('/docs/api'))) as any).toMatchObject({ view: 'api-docs' });
    expect((await handler(req('/docs/intro'))) as any).toMatchObject({
      view: 'doc-page',
    });
    expect((await handler(req('/docs/guide/install'))) as any).toMatchObject({
      view: 'docs-splat',
    });
  });
});

describe('defineRoutes — params.parse', () => {
  it('transforms params on success', async () => {
    const handler = defineRoutes([
      {
        path: '/posts/$id',
        view: 'post',
        params: {
          parse: ({ id }) => ({ id: Number(id) }),
        },
      },
    ]);
    expect(await handler(req('/posts/123'))).toEqual({
      view: 'post',
      params: { id: 123 },
    });
  });

  it('wraps thrown errors as BadRequestException', async () => {
    const handler = defineRoutes([
      {
        path: '/posts/$id',
        view: 'post',
        params: {
          parse: ({ id }) => {
            if (!/^\d+$/.test(id)) throw new Error('id must be numeric');
            return { id: Number(id) };
          },
        },
      },
    ]);
    await expect(handler(req('/posts/abc'))).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('defineRoutes — params.schema (Zod-compatible)', () => {
  // Structural adapter — anything with a `.parse(raw): T` method satisfies ParamsSchema.
  // Zod's z.object(...) matches this shape with no import.
  const numericIdSchema = {
    parse: (raw: Record<string, string>) => {
      if (!/^\d+$/.test(raw.id)) {
        throw new Error('id must be numeric');
      }
      return { id: Number(raw.id) };
    },
  };

  it('runs schema.parse on captured params', async () => {
    const handler = defineRoutes([
      { path: '/posts/$id', view: 'post', params: { schema: numericIdSchema } },
    ]);
    expect(await handler(req('/posts/42'))).toEqual({
      view: 'post',
      params: { id: 42 },
    });
  });

  it('wraps schema.parse errors as BadRequestException', async () => {
    const handler = defineRoutes([
      { path: '/posts/$id', view: 'post', params: { schema: numericIdSchema } },
    ]);
    await expect(handler(req('/posts/abc'))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('parse wins over schema when both are set', async () => {
    const handler = defineRoutes([
      {
        path: '/posts/$id',
        view: 'post',
        params: {
          parse: () => ({ id: 'from-parse' }),
          schema: { parse: () => ({ id: 'from-schema' }) },
        },
      },
    ]);
    expect(await handler(req('/posts/1'))).toEqual({
      view: 'post',
      params: { id: 'from-parse' },
    });
  });

  it('preserves `this` when calling schema.parse', async () => {
    // Zod and similar libraries may rely on `this` inside their parse method.
    class CountingSchema {
      calls = 0;
      parse(raw: Record<string, string>) {
        this.calls += 1;
        return { id: raw.id, callCount: this.calls };
      }
    }
    const schema = new CountingSchema();
    const handler = defineRoutes([
      { path: '/posts/$id', view: 'post', params: { schema } },
    ]);
    const result = await handler(req('/posts/abc'));
    expect(result).toEqual({ view: 'post', params: { id: 'abc', callCount: 1 } });
    expect(schema.calls).toBe(1);
  });
});

describe('defineRoutes — async resolve', () => {
  it('returns view name string from resolve', async () => {
    const handler = defineRoutes([
      {
        path: '/$slug',
        resolve: async ({ params }) => (params.slug === 'about' ? 'about' : null),
      },
    ]);
    expect(await handler(req('/about'))).toEqual({ view: 'about', params: {} });
  });

  it('returns object result from resolve', async () => {
    const handler = defineRoutes([
      {
        path: '/$slug',
        resolve: async ({ params }) => ({
          view: 'article',
          params: { slug: params.slug, id: 42 },
        }),
      },
    ]);
    expect(await handler(req('/hello'))).toEqual({
      view: 'article',
      params: { slug: 'hello', id: 42 },
    });
  });

  it('null from resolve becomes top-level null (no fallthrough)', async () => {
    const handler = defineRoutes([
      {
        path: '/$slug',
        resolve: async () => null,
      },
      { path: '/fallback', view: 'fallback' },
    ]);
    // /unknown matches /$slug; resolve returns null → handler returns null
    expect(await handler(req('/unknown'))).toBeNull();
  });

  it('resolve wins when both view and resolve are set', async () => {
    const handler = defineRoutes([
      {
        path: '/$slug',
        view: 'static-view',
        resolve: async () => ({ view: 'dynamic-view', params: { extra: true } }),
      },
    ]);
    expect(await handler(req('/x'))).toEqual({
      view: 'dynamic-view',
      params: { extra: true },
    });
  });

  it('propagates RedirectException from resolve', async () => {
    const handler = defineRoutes([
      {
        path: '/$slug',
        resolve: async () => {
          throw new RedirectException('/new', 301);
        },
      },
    ]);
    await expect(handler(req('/old'))).rejects.toBeInstanceOf(RedirectException);
  });

  it('supports synchronous resolve return values', async () => {
    const handler = defineRoutes([
      {
        path: '/$slug',
        resolve: ({ params }) => `view-${params.slug}`,
      },
    ]);
    expect(await handler(req('/foo'))).toEqual({ view: 'view-foo', params: {} });
  });
});

describe('defineRoutes — config errors', () => {
  it('throws if route has neither view nor resolve', () => {
    expect(() => defineRoutes([{ path: '/x' } as any])).toThrowError(
      /must define either "view" or "resolve"/,
    );
  });

  it('throws on invalid path syntax during construction', () => {
    expect(() => defineRoutes([{ path: 'no-leading-slash', view: 'x' }])).toThrow();
  });

  it('throws if routes is not an array', () => {
    expect(() => defineRoutes('foo' as any)).toThrowError(TypeError);
  });
});
