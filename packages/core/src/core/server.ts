import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { existsSync } from 'fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import requestIp from 'request-ip';
import type { ViteDevServer } from 'vite';
import { createContext, type MiddlewareHandler, type RewritePayload } from '../middleware';
import { bundleCss, bundleScripts, getBundledFile } from './bundler';
import type { RenderResult, RequestInfo } from './entry-server';
import { createHeadersFromExpressRequest, parseCookies } from './request';

export interface ServerOptions {
  root?: string;
  port?: number;
  base?: string;
  publicDir?: string;
  setupApp?: (app: any) => void | Promise<void>;
  app?: any; // Express
}

export interface ServerContext {
  app: any; // Express app
  vite?: ViteDevServer;
}

/**
 * Apply or replace lang attribute on <html> tag
 */
function applyHtmlLang(template: string, lang: string): string {
  return template.replace(/<html\b([^>]*)>/i, (match, attrs) => {
    // Check if lang already exists
    if (/\blang\s*=/i.test(attrs)) {
      // Replace existing lang value
      return match.replace(/lang\s*=\s*"[^"]*"/i, `lang="${lang}"`);
    } else {
      // Add lang attribute
      return `<html lang="${lang}"${attrs}>`;
    }
  });
}

type EntryServerModule = {
  render: (url: string, requestInfo?: RequestInfo) => Promise<RenderResult>;
  loadMiddleware?: () => Promise<MiddlewareHandler | undefined>;
};

function getRequestUrl(req: ExpressRequest): URL {
  return new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`);
}

function getRenderUrl(urlObject: URL, base: string): string {
  const requestPath = `${urlObject.pathname}${urlObject.search}`;
  return requestPath.replace(base, '') || '/';
}

function createWebRequestFromExpress(req: ExpressRequest): globalThis.Request {
  const init: RequestInit & { duplex?: 'half' } = {
    method: req.method,
    headers: createHeadersFromExpressRequest(req),
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req as unknown as BodyInit;
    init.duplex = 'half';
  }

  return new globalThis.Request(getRequestUrl(req).href, init);
}

function createRequestInfo(
  req: ExpressRequest,
  webRequest: globalThis.Request,
  base: string,
  locals: Record<string, unknown>,
): RequestInfo {
  const urlObject = new URL(webRequest.url);
  const renderUrl = getRenderUrl(urlObject, base);
  const normalizedPath = renderUrl.startsWith('/') ? renderUrl : `/${renderUrl}`;
  const headers: Record<string, string> = {};
  webRequest.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    url: urlObject,
    path: normalizedPath,
    pathname: urlObject.pathname,
    method: webRequest.method,
    headers,
    cookies: parseCookies(webRequest.headers.get('cookie') ?? undefined),
    query: Object.fromEntries(urlObject.searchParams.entries()),
    ip: requestIp.getClientIp(req) ?? undefined,
    locals,
  };
}

function createRewriteRequest(
  payload: RewritePayload | undefined,
  currentRequest: globalThis.Request,
  currentUrl: URL,
): globalThis.Request {
  if (!payload) {
    return currentRequest;
  }

  if (payload instanceof globalThis.Request) {
    return payload;
  }

  if (payload instanceof URL) {
    return new globalThis.Request(payload.href, currentRequest.clone());
  }

  return new globalThis.Request(new URL(payload, currentUrl).href, currentRequest.clone());
}

async function sendWebResponse(
  req: ExpressRequest,
  res: ExpressResponse,
  response: globalThis.Response,
): Promise<void> {
  res.status(response.status);
  const setCookieValues = getSetCookieHeaders(response.headers);
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      return;
    }
    res.setHeader(key, value);
  });
  if (setCookieValues.length > 0) {
    res.setHeader('Set-Cookie', setCookieValues);
  }

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  const body = Buffer.from(await response.arrayBuffer());
  res.send(body);
}

function getSetCookieHeaders(headers: Headers): string[] {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getSetCookie === 'function') {
    return getSetCookie.call(headers);
  }

  const raw = (headers as Headers & { raw?: () => Record<string, string[]> }).raw?.();
  if (raw?.['set-cookie']) {
    return raw['set-cookie'];
  }

  const value = headers.get('set-cookie');
  return value ? splitSetCookieHeader(value) : [];
}

function splitSetCookieHeader(value: string): string[] {
  const cookies: string[] = [];
  let start = 0;

  for (let i = 0; i < value.length; i++) {
    if (value[i] !== ',') continue;

    const rest = value.slice(i + 1);
    if (/^\s*[^=;,]+=/.test(rest)) {
      cookies.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }

  cookies.push(value.slice(start).trim());
  return cookies.filter(Boolean);
}

function createRawResponse(rendered: RenderResult): globalThis.Response | null {
  if (!rendered.rawResponse) {
    return null;
  }

  const { body, contentType, statusCode, headers } = rendered.rawResponse;
  const responseHeaders = new Headers(headers);
  responseHeaders.set('Content-Type', contentType);

  return new globalThis.Response(body as BodyInit, {
    status: statusCode || 200,
    headers: responseHeaders,
  });
}

async function createPageResponse({
  rendered,
  template,
  manifest,
  root,
  distClientDir,
  isProduction,
}: {
  rendered: RenderResult;
  template: string;
  manifest?: Record<string, any>;
  root: string;
  distClientDir: string;
  isProduction: boolean;
}): Promise<globalThis.Response> {
  const rawResponse = createRawResponse(rendered);
  if (rawResponse) {
    return rawResponse;
  }

  if (rendered.redirect) {
    return new globalThis.Response(null, {
      status: rendered.redirect.statusCode,
      headers: {
        Location: rendered.redirect.url,
      },
    });
  }

  let scriptSrcList: string[] = rendered.scripts || [];
  let cssSrcList: string[] = rendered.styles || [];
  const islandEntries = rendered.islands || [];
  let cacheTags: string[] = rendered.cacheTags || [];
  const maxAge: number | undefined = rendered.maxAge;
  const sMaxAge: number | undefined = rendered.sMaxAge;
  const swr: number | undefined = rendered.swr;

  let extraHead = '';
  let globalScripts: string[] = [];
  let islandRegistryScript = '';

  if (isProduction && manifest) {
    scriptSrcList = scriptSrcList.filter((src) => !src.includes('.global.'));
    cssSrcList = cssSrcList.filter((src) => !src.includes('.global.'));

    const cssFiles = new Set<string>();
    const preloadFiles = new Set<string>();

    function collectFromEntry(entryKey: string): { file: string | null } {
      const entry = manifest![entryKey];
      if (!entry) return { file: null };

      if (entry.css) entry.css.forEach((css: string) => cssFiles.add(css));
      if (entry.imports) {
        entry.imports.forEach((importKey: string) => {
          const importedChunk = manifest![importKey];
          if (importedChunk?.file) preloadFiles.add(importedChunk.file);
          if (importedChunk?.css) {
            importedChunk.css.forEach((css: string) => cssFiles.add(css));
          }
          if (importedChunk?.imports) {
            importedChunk.imports.forEach((key: string) => {
              const chunk = manifest![key];
              if (chunk?.file) preloadFiles.add(chunk.file);
              if (chunk?.css) chunk.css.forEach((css: string) => cssFiles.add(css));
            });
          }
        });
      }

      return { file: entry.file };
    }

    const mappedScripts: string[] = [];
    for (const src of scriptSrcList) {
      const entryKey = src.replace(/^\//, '');
      const { file } = collectFromEntry(entryKey);
      if (file) mappedScripts.push(`/${file}`);
    }

    const mappedCssFiles: string[] = [];
    for (const src of cssSrcList) {
      const entryKey = src.replace(/^\//, '');
      const { file } = collectFromEntry(entryKey);
      if (file) {
        mappedCssFiles.push(`/${file}`);
        cssFiles.add(file);
      }
    }

    if (mappedScripts.length > 0) {
      const bundledScript = await bundleScripts(mappedScripts, root, distClientDir);
      scriptSrcList = bundledScript.filename ? [`/${bundledScript.filename}`] : mappedScripts;
    }

    if (mappedCssFiles.length > 0) {
      const bundledCss = await bundleCss(mappedCssFiles, root, distClientDir);
      if (bundledCss.filename) {
        cssSrcList = [`/${bundledCss.filename}`];
      }
    }

    const globalEntry = manifest['src/client.global.ts'];
    if (globalEntry) {
      if (globalEntry.css && globalEntry.css.length > 0) {
        globalEntry.css.forEach((cssFile: string) => {
          extraHead += `<link rel="stylesheet" crossorigin href="/${cssFile}">`;
        });
      }
      if (globalEntry.file) {
        globalScripts.push(`/${globalEntry.file}`);
      }
    }

    if (islandEntries.length > 0) {
      const islandMap: Record<string, string> = {};
      for (const island of islandEntries) {
        const entry = manifest[island.src];
        if (entry?.file) {
          islandMap[island.key] = `/${entry.file}`;
        }
      }
      if (Object.keys(islandMap).length > 0) {
        islandRegistryScript = `<script>window.__L5E_ISLANDS__=${JSON.stringify(islandMap)}</script>`;
      }
    }

    if (cssSrcList.length > 0) {
      extraHead += cssSrcList
        .map((file) => `<link rel="stylesheet" crossorigin href="${file}">`)
        .join('');
    }
  }

  let cssHtml = '';
  if (!isProduction) {
    cssHtml = cssSrcList.map((src) => `<link rel="stylesheet" href="${src}">`).join('');
  }

  let allScripts = [...globalScripts, ...scriptSrcList];

  if (!isProduction) {
    const globalTsPath = path.join(root, 'src', 'client.global.ts');
    if (existsSync(globalTsPath)) {
      allScripts = ['/src/client.global.ts', ...allScripts];
    }

    if (islandEntries.length > 0) {
      const islandMap: Record<string, string> = {};
      for (const island of islandEntries) {
        islandMap[island.key] = `/${island.src}`;
      }
      islandRegistryScript = `<script>window.__L5E_ISLANDS__=${JSON.stringify(islandMap)}</script>`;
    }
  }

  const scriptsHtml =
    islandRegistryScript +
    allScripts.map((src) => `<script type="module" src="${src}"></script>`).join('');

  const templateWithLang = rendered.lang ? applyHtmlLang(template, rendered.lang) : template;

  const html = rendered.rawHtml
    ? rendered.html || ''
    : templateWithLang
        .replace(`<!--app-head-->`, (rendered.head ?? '') + extraHead + cssHtml)
        .replace(`<!--app-html-->`, rendered.html ?? '')
        .replace(`<!--app-scripts-->`, scriptsHtml);

  const headers = new Headers({
    'Content-Type': 'text/html',
  });

  const cacheControlParts: string[] = ['public'];
  if (maxAge !== undefined) cacheControlParts.push(`max-age=${maxAge}`);
  if (sMaxAge !== undefined) cacheControlParts.push(`s-maxage=${sMaxAge}`);
  if (swr !== undefined) cacheControlParts.push(`stale-while-revalidate=${swr}`);

  if (cacheControlParts.length > 1 && isProduction) {
    headers.set('Cache-Control', cacheControlParts.join(', '));
  }

  if (process.env.NODE_ENV === 'production') {
    cacheTags = optimizeCacheTags(cacheTags);
  }
  headers.set('Cache-Tag', ['global', ...cacheTags].join(','));

  return new globalThis.Response(html, {
    status: rendered.statusCode || 200,
    headers,
  });
}

export async function createServer(options: ServerOptions = {}): Promise<ServerContext> {
  const root = options.root || process.cwd();
  const base = options.base || '/';
  const isProduction = process.env.NODE_ENV === 'production';

  // Cached production assets
  const templateHtml = isProduction
    ? await fs.readFile(path.join(root, './index.html'), 'utf-8')
    : '';

  // Create http server
  // @ts-ignore
  const express = (await import('express')).default;
  const app = options.app || express();

  // Serve static files from public directory
  if (options.publicDir) {
    const publicPath = path.isAbsolute(options.publicDir)
      ? options.publicDir
      : path.join(root, options.publicDir);

    if (existsSync(publicPath)) {
      app.use(express.static(publicPath));
    }
  }

  // Add Vite or respective production middlewares
  let vite: ViteDevServer | undefined;
  const distClientDir = path.join(root, './dist/client');

  if (!isProduction) {
    const { createServer } = await import('vite');
    const configFile = path.join(root, 'vite.config.js');
    vite = await createServer({
      root,
      configFile,
      server: { middlewareMode: true },
      appType: 'custom',
      base,
      optimizeDeps: {
        exclude: ['@l5e/core', 'file-type'],
      },
      ssr: {
        resolve: {
          conditions: ['development', 'default'],
        },
      },
      resolve: {
        conditions: ['development', 'default'],
      },
    });
    app.use(vite.middlewares);
  } else {
    // @ts-ignore
    const compression = (await import('compression')).default;
    // @ts-ignore
    const sirv = (await import('sirv')).default;
    app.use(compression());
    app.use(base, sirv(distClientDir, { extensions: [] }));

    // Route để serve bundled files từ memory map
    // Đặt route này trước route HTML để catch request trước
    app.get(
      `${base === '/' ? '' : base}/bundle-:hash.:ext`,
      async (req: ExpressRequest, res: ExpressResponse) => {
        try {
          const { hash, ext } = req.params;
          const filename = `bundle-${hash}.${ext}`;
          const bundledFile = getBundledFile(filename);

          if (!bundledFile) {
            return res.status(404).send('Bundled file not found');
          }

          res.set({
            'Content-Type': bundledFile.mimeType,
            'Cache-Control': 'public, max-age=31536000, immutable',
          });
          res.send(bundledFile.content);
        } catch (e: any) {
          console.error('[server] Error serving bundled file:', e);
          res.status(500).end(e.message);
        }
      },
    );
  }

  // Action routes — JSON body parsing scoped to action endpoints only
  app.use('/_l5e/action', express.json({ limit: '100kb' }));

  // Validate action key format: actionName_hexHash
  const ACTION_KEY_RE = /^[a-zA-Z]\w+_[0-9a-f]{1,4}$/;

  // Load action registry and viewActions glob from virtual module (dev) or built bundle (prod)
  let prodActionRegistry: Record<string, { modulePath: string; actionName: string }> | null = null;
  let prodViewActions: Record<string, () => Promise<any>> | null = null;

  async function getActionRegistry(): Promise<
    Record<string, { modulePath: string; actionName: string }>
  > {
    if (!isProduction) {
      const mod = await vite!.ssrLoadModule('virtual:l5e-actions');
      return mod.actionRegistry || {};
    }
    if (!prodActionRegistry) {
      const registryPath = path.join(root, './dist/server/action-registry.json');
      const json = await fs.readFile(registryPath, 'utf-8');
      prodActionRegistry = JSON.parse(json);
    }
    return prodActionRegistry!;
  }

  async function getViewActions(): Promise<Record<string, () => Promise<any>>> {
    if (!isProduction) {
      const mod = await vite!.ssrLoadModule('virtual:l5e-actions');
      return mod.viewActions || {};
    }
    if (!prodViewActions) {
      const entryServerPath = path.join(root, './dist/server/entry-server.js');
      const mod = await import(pathToFileURL(entryServerPath).href);
      prodViewActions = mod.viewActions || {};
    }
    return prodViewActions!;
  }

  // Action route handler — hashed action keys
  // URL: /_l5e/action/:actionKey  (e.g., /_l5e/action/loadMoreComments_a1b2)
  app.all('/_l5e/action/:actionKey', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
      const { actionKey } = req.params;

      // Validate action key format
      if (!ACTION_KEY_RE.test(actionKey)) {
        return res.status(400).send('Invalid action key');
      }

      // Look up action in registry
      const registry = await getActionRegistry();
      const entry = registry[actionKey];
      if (!entry) {
        return res.status(404).send('Action not found');
      }

      const { modulePath, actionName } = entry;

      // Import action module via viewActions glob (works in both dev and prod)
      let actionModule: any;
      if (!isProduction) {
        try {
          actionModule = await vite!.ssrLoadModule(`/src/${modulePath}/actions.tsx`);
        } catch {
          actionModule = await vite!.ssrLoadModule(`/src/${modulePath}/actions.ts`);
        }
      } else {
        const viewActions = await getViewActions();
        // Find matching glob entry by modulePath
        const globKey = viewActions[`/src/${modulePath}/actions.tsx`]
          ? `/src/${modulePath}/actions.tsx`
          : viewActions[`/src/${modulePath}/actions.ts`]
            ? `/src/${modulePath}/actions.ts`
            : null;
        if (!globKey) {
          return res.status(404).send('Action module not found');
        }
        actionModule = await viewActions[globKey]();
      }

      // Look up exported action — use hasOwnProperty to avoid prototype pollution
      if (!Object.prototype.hasOwnProperty.call(actionModule, actionName)) {
        return res.status(404).send('Action not found');
      }
      const action = actionModule[actionName];
      if (!action || !action.handler) {
        return res.status(404).send('Action not found');
      }

      // Build RequestInfo (same pattern as HTML handler)
      const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const urlObject = new URL(fullUrl);

      const requestInfo = {
        url: urlObject,
        path: req.originalUrl,
        pathname: urlObject.pathname,
        method: req.method,
        headers: req.headers,
        cookies: parseCookies(req.headers.cookie as string),
        query: req.query || {},
        body: req.body,
        ip: requestIp.getClientIp(req),
      };

      // Import render utilities from entry-server (bundled in SSR build)
      const entryServerPath = path.join(root, './dist/server/entry-server.js');
      const { runInRenderContext } = await (isProduction
        ? import(pathToFileURL(entryServerPath).href)
        : vite!.ssrLoadModule('@l5e/core/jsx-runtime'));
      const { renderJsxToHtmlString } = await (isProduction
        ? import(pathToFileURL(entryServerPath).href)
        : vite!.ssrLoadModule('@l5e/core'));

      // Run action handler in render context (needed for JSX)
      const html = await runInRenderContext(
        async () => {
          const jsx = await action.handler(requestInfo);
          return renderJsxToHtmlString(jsx);
        },
        requestInfo,
        modulePath,
      );

      res.set('Content-Type', 'text/html').send(html);
    } catch (e: any) {
      vite?.ssrFixStacktrace?.(e);
      console.error('[l5e] Action error:', e.stack || e);
      res.status(500).send('Internal server error');
    }
  });

  // Serve HTML
  app.use(async (req: ExpressRequest, res: ExpressResponse) => {
    try {
      const url = req.originalUrl.replace(base, '');

      let template: string;
      let render: (url: string, requestInfo?: any) => Promise<any>;
      let loadMiddleware: EntryServerModule['loadMiddleware'];
      let manifest: Record<string, any> | undefined;

      if (!isProduction) {
        // Always read fresh template in development
        template = await fs.readFile(path.join(root, './index.html'), 'utf-8');
        template = await vite!.transformIndexHtml(url, template);

        // Inject Vite HMR client for hot reload
        if (!template.includes('@vite/client')) {
          template = template.replace(
            '</head>',
            '<script type="module" src="/@vite/client"></script></head>',
          );
        }

        const entryServer = (await vite!.ssrLoadModule(
          '@l5e/core/entry-server',
        )) as EntryServerModule;
        render = entryServer.render;
        loadMiddleware = entryServer.loadMiddleware;
      } else {
        template = templateHtml;
        const entryServerPath = path.join(root, './dist/server/entry-server.js');
        const entryServer = (await import(
          pathToFileURL(entryServerPath).href
        )) as EntryServerModule;
        render = entryServer.render;
        loadMiddleware = entryServer.loadMiddleware;
        // Read manifest to map hashed assets
        const manifestJson = await fs.readFile(
          path.join(root, './dist/client/.vite/manifest.json'),
          'utf-8',
        );
        manifest = JSON.parse(manifestJson);
      }

      const loadedMiddleware = await loadMiddleware?.();
      const handler: MiddlewareHandler =
        typeof loadedMiddleware === 'function' ? loadedMiddleware : (_ctx, next) => next();

      const locals: Record<string, unknown> = {};
      const initialRequest = createWebRequestFromExpress(req);
      const context = createContext({
        request: initialRequest,
        requestInfo: createRequestInfo(req, initialRequest, base, locals),
        locals,
        clientAddress: requestIp.getClientIp(req),
      });

      const renderResponse = async (webRequest: globalThis.Request) => {
        const nextRequestInfo = createRequestInfo(req, webRequest, base, locals);
        const nextUrl = getRenderUrl(nextRequestInfo.url!, base);
        const nextRendered = await render(nextUrl, nextRequestInfo);
        return createPageResponse({
          rendered: nextRendered,
          template,
          manifest,
          root,
          distClientDir,
          isProduction,
        });
      };

      const next = async (payload?: RewritePayload) => {
        const nextRequest = createRewriteRequest(payload, context.request, context.url);
        context.request = nextRequest;
        context.url = new URL(nextRequest.url);
        context.cookies = parseCookies(nextRequest.headers.get('cookie') ?? undefined);
        context.requestInfo = createRequestInfo(req, nextRequest, base, locals);
        return renderResponse(nextRequest);
      };

      context.rewrite = (payload: RewritePayload) => next(payload);

      const response = await handler(context, next);
      await sendWebResponse(req, res, response);
    } catch (e: any) {
      vite?.ssrFixStacktrace?.(e);
      console.log(e.stack);
      res.status(500).end(e.stack);
    }
  });

  return { app, vite };
}

export async function startServer(options: ServerOptions = {}): Promise<void> {
  const port = options.port || 5173;

  // Create Express app first
  // @ts-ignore
  const express = (await import('express')).default;
  const app = express();

  // Call callback if provided to allow custom routes before setting up L5E server
  if (options.setupApp) {
    console.log('setupApp');
    await options.setupApp(app);
  }

  const { app: serverApp } = await createServer({ ...options, app });

  serverApp.listen(port, () => {
    console.log(`Server started at http://localhost:${port}`);
  });
}

const MAX_TAGS = 1000;

export function hashTag(tag: string): string {
  // global tag is not hashed, better for ci/cd
  if (tag === 'global') {
    return 'global';
  }

  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    const char = tag.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).substring(0, 8);
}

export function optimizeCacheTags(tags: Set<string> | string[]): string[] {
  const _tags = Array.isArray(tags) ? tags : [...tags];
  const result = _tags.slice(0, MAX_TAGS).map(hashTag);
  return result;
}
