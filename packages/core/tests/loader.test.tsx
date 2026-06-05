import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsxFactory as jsxFactoryAlias } from '../src/core/jsx-runtime';

// Ensure JSX in this file transpiles to our factory (auto-injected by coreVite)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const jsxFactory = jsxFactoryAlias;

/**
 * `render()` in entry-server.ts wires the route handler, the global/view
 * loaders, generateMetadata and generateSchema together. Those are normally
 * supplied through Vite virtual modules, so we mock them here (the same way
 * Astro drives a fixture app and Next mocks the loaders) and then exercise the
 * REAL `render()` pipeline end to end. This is the layer where the JSON-LD XSS
 * lived — untested before — so these tests both document loader behaviour and
 * lock the security fix.
 */
const mocks = vi.hoisted(() => ({
  routeHandler: (_req: any): any => null,
  viewComponents: {} as Record<string, () => Promise<any>>,
  viewLoaders: {} as Record<string, () => Promise<any>>,
  globalLoader: {} as Record<string, () => Promise<any>>,
}));

vi.mock('virtual:l5e-route', () => ({ default: (req: any) => mocks.routeHandler(req) }));
vi.mock('virtual:l5e-views', () => ({
  viewComponents: mocks.viewComponents,
  viewLoaders: mocks.viewLoaders,
}));
vi.mock('virtual:l5e-global-loader', () => ({ globalLoader: mocks.globalLoader }));
vi.mock('virtual:l5e-middleware', () => ({ loadMiddleware: async () => undefined }));

// Imported after the mocks are registered.
import { render } from '../src/core/entry-server';
import type { RequestInfo } from '../src/core/entry-server';
import { NotFoundException } from '../src/core/exceptions';

type ViewModule = { default: (props: any) => any };
type LoaderModule = {
  loader?: (req: RequestInfo) => any;
  generateMetadata?: (req: RequestInfo, props: any) => any;
  generateSchema?: (req: RequestInfo, props: any) => any;
};

/** Register a view (component + optional loader) under /src/views/<name>/ */
function registerView(name: string, component: ViewModule['default'], loader?: LoaderModule) {
  mocks.viewComponents[`/src/views/${name}/index.tsx`] = async () => ({ default: component });
  if (loader) {
    mocks.viewLoaders[`/src/views/${name}/loader.ts`] = async () => loader;
  }
}

function makeRequest(path = '/', query: Record<string, any> = {}): RequestInfo {
  return {
    url: new URL(`https://example.com${path}`),
    path,
    pathname: path,
    method: 'GET',
    headers: {},
    cookies: {},
    query,
  };
}

beforeEach(() => {
  mocks.routeHandler = () => null;
  for (const key of Object.keys(mocks.viewComponents)) delete mocks.viewComponents[key];
  for (const key of Object.keys(mocks.viewLoaders)) delete mocks.viewLoaders[key];
  for (const key of Object.keys(mocks.globalLoader)) delete mocks.globalLoader[key];
});

describe('loader → render pipeline', () => {
  it('passes loader props to the view component', async () => {
    mocks.routeHandler = () => 'home';
    registerView('home', (props) => <h1>{props.greeting}</h1>, {
      loader: async () => ({ props: { greeting: 'Hello loader' } }),
    });

    const result = await render('/', makeRequest('/'));

    expect(result.html).toBe('<h1>Hello loader</h1>');
  });

  it('merges global loader props with view loader props (view wins)', async () => {
    mocks.routeHandler = () => 'home';
    mocks.globalLoader['/src/global-loader.ts'] = async () => ({
      loader: async () => ({ props: { site: 'L5E', greeting: 'global' } }),
    });
    registerView('home', (props) => <p>{`${props.site}:${props.greeting}`}</p>, {
      loader: async () => ({ props: { greeting: 'view' } }),
    });

    const result = await render('/', makeRequest('/'));

    expect(result.html).toBe('<p>L5E:view</p>');
  });

  it('propagates cache + lang fields from the loader to RenderResult', async () => {
    mocks.routeHandler = () => 'home';
    registerView('home', () => <div>ok</div>, {
      loader: async () => ({
        props: {},
        lang: 'vi',
        maxAge: 60,
        sMaxAge: 120,
        swr: 30,
        cacheTags: ['home', 'list'],
      }),
    });

    const result = await render('/', makeRequest('/'));

    expect(result.lang).toBe('vi');
    expect(result.maxAge).toBe(60);
    expect(result.sMaxAge).toBe(120);
    expect(result.swr).toBe(30);
    expect(result.cacheTags).toEqual(expect.arrayContaining(['home', 'list']));
  });

  it('lets the view loader lang override the global loader lang', async () => {
    mocks.routeHandler = () => 'home';
    mocks.globalLoader['/src/global-loader.ts'] = async () => ({
      loader: async () => ({ props: {}, lang: 'en' }),
    });
    registerView('home', () => <div>ok</div>, {
      loader: async () => ({ props: {}, lang: 'fr' }),
    });

    const result = await render('/', makeRequest('/'));

    expect(result.lang).toBe('fr');
  });

  it('short-circuits to a raw response when the loader returns one', async () => {
    mocks.routeHandler = () => 'feed';
    registerView('feed', () => <div>should-not-render</div>, {
      loader: async () => ({
        rawResponse: {
          body: '{"ok":true}',
          contentType: 'application/json',
          statusCode: 201,
        },
      }),
    });

    const result = await render('/feed.json', makeRequest('/feed.json'));

    expect(result.rawResponse).toEqual({
      body: '{"ok":true}',
      contentType: 'application/json',
      statusCode: 201,
    });
    expect(result.statusCode).toBe(201);
    expect(result.html).toBeUndefined();
  });

  it('returns a 404 RenderResult when the route does not match', async () => {
    mocks.routeHandler = () => null;

    const result = await render('/missing', makeRequest('/missing'));

    expect(result.statusCode).toBe(404);
  });

  it('renders the error view as a 503 when a loader throws', async () => {
    mocks.routeHandler = () => 'home';
    registerView('home', () => <div>never</div>, {
      loader: async () => {
        throw new Error('db down');
      },
    });

    const result = await render('/', makeRequest('/'));

    expect(result.statusCode).toBe(503);
  });
});

describe('loader-driven SEO is XSS-safe (regression for the JSON-LD bug)', () => {
  const BREAKOUT = '</script><img src=x onerror=alert(1)>';

  it('escapes user-derived generateSchema output inside the ld+json <script>', async () => {
    mocks.routeHandler = () => 'article';
    registerView('article', (props) => <h1>{props.title}</h1>, {
      loader: async (req) => ({ props: { title: req.query.q } }),
      // schema headline comes straight from a query param — attacker controlled
      generateSchema: (_req, props) => ({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: props.title,
      }),
    });

    const result = await render('/article', makeRequest('/article', { q: BREAKOUT }));
    const head = result.head ?? '';

    // The JSON-LD block is present...
    expect(head).toContain('application/ld+json');
    // ...but the payload cannot break out of the <script> element.
    expect(head).not.toContain('</script><img');
    expect(head).not.toContain('<img src=x');
    expect(head).not.toContain('onerror=alert(1)>');
    // serialize-javascript encodes "<" / "/" as unicode escapes inside the JSON.
    expect(head).toContain('\\u003C');
  });

  it('escapes user-derived generateMetadata title/description', async () => {
    mocks.routeHandler = () => 'article';
    registerView('article', () => <div>ok</div>, {
      loader: async (req) => ({ props: { q: req.query.q } }),
      generateMetadata: (_req, props) => ({
        title: props.q,
        description: props.q,
      }),
    });

    const result = await render('/article', makeRequest('/article', { q: '<script>alert(1)</script>' }));
    const head = result.head ?? '';

    expect(head).not.toContain('<script>alert(1)</script>');
    expect(head).toContain('&lt;script&gt;');
  });
});

describe('error view info disclosure (#4)', () => {
  function withNodeEnv(value: string, fn: () => Promise<void>): Promise<void> {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = value;
    return fn().finally(() => {
      process.env.NODE_ENV = prev;
    });
  }

  it('hides an unexpected error message + stack in production (default error view)', async () => {
    mocks.routeHandler = () => 'home';
    registerView('home', () => <div>never</div>, {
      loader: async () => {
        const e = new Error('SECRET db password=hunter2');
        e.stack = 'Error: SECRET db password=hunter2\n    at /app/secret.ts:42';
        throw e;
      },
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await withNodeEnv('production', async () => {
      const result = await render('/', makeRequest('/'));
      const html = result.html ?? '';
      expect(result.statusCode).toBe(503);
      expect(html).not.toContain('SECRET');
      expect(html).not.toContain('secret.ts');
      expect(html).not.toContain('password');
      expect(html).toContain('Internal Server Error');
    });
    errSpy.mockRestore();
  });

  it('keeps full error detail in development', async () => {
    mocks.routeHandler = () => 'home';
    registerView('home', () => <div>never</div>, {
      loader: async () => {
        throw new Error('boom-dev-detail');
      },
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await withNodeEnv('development', async () => {
      const result = await render('/', makeRequest('/'));
      expect(result.html ?? '').toContain('boom-dev-detail');
    });
    errSpy.mockRestore();
  });

  it('does not pass the stack into the _error view props in production', async () => {
    mocks.routeHandler = () => 'home';
    registerView('home', () => <div>never</div>, {
      loader: async () => {
        const e = new Error('unexpected');
        e.stack = 'STACKLINE at /app/x.ts:1';
        throw e;
      },
    });
    // An _error view that would render whatever stack it is given.
    registerView('_error', (props: any) => <pre>{props.data?.stack ?? 'no-stack'}</pre>);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await withNodeEnv('production', async () => {
      const result = await render('/', makeRequest('/'));
      expect(result.html ?? '').not.toContain('STACKLINE');
      expect(result.html ?? '').toContain('no-stack');
    });
    errSpy.mockRestore();
  });

  it('still shows intentional HttpException messages in production (known errors)', async () => {
    // `throw new NotFoundException("lý do")` is developer-authored — the reason
    // SHOULD reach the client, even in production.
    mocks.routeHandler = () => 'product';
    registerView('product', () => <div>never</div>, {
      loader: async () => {
        throw new NotFoundException('Sản phẩm không tồn tại');
      },
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await withNodeEnv('production', async () => {
      const result = await render('/product', makeRequest('/product'));
      expect(result.statusCode).toBe(404);
      expect(result.html ?? '').toContain('Sản phẩm không tồn tại');
    });
    errSpy.mockRestore();
  });
});
