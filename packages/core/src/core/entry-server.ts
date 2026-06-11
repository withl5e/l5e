/// <reference path="./jsx-types.d.ts" />
import serialize from 'serialize-javascript';
import { MetadataRenderer } from '../seo/generateMetadata';
import type { Metadata } from '../seo/types';
import {
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  RedirectException,
  ServiceUnavailableException,
} from './exceptions';
import { HEAD_PRIORITY } from './head-priority';
import {
  addCacheTag,
  getCacheTags,
  getClientJsEntries,
  getCssEntries,
  getHeadContent,
  getIslandEntries,
  getSchemas,
  getSsrIslands,
  jsxFactory as h,
  Head,
  pushMetadata,
  pushSchema,
  runInRenderContext,
  setViewName,
} from './jsx-runtime';
import { renderJsxToHtmlString } from './render';
// @ts-ignore - Virtual modules provided by Vite plugin
import { viewComponents, viewLoaders } from 'virtual:l5e-views';
// @ts-ignore - Virtual modules provided by Vite plugin
import routeHandler from 'virtual:l5e-route';
// @ts-ignore - Virtual modules provided by Vite plugin
import { globalLoader } from 'virtual:l5e-global-loader';
// @ts-ignore - Virtual modules provided by Vite plugin
export { loadMiddleware } from 'virtual:l5e-middleware';
// @ts-ignore - Virtual modules provided by Vite plugin
import { islandModules } from 'virtual:l5e-islands';

/**
 * Fill `ssr` island placeholders with server-rendered HTML.
 *
 * During the synchronous render pass, each `<ClientIsland ssr>` emits a unique
 * token (as `<!--token-->` body + `data-island-ssr="token"`). Here — after the
 * pass — we can `await import()` the actual React component and renderToString it,
 * then string-replace the token. Only islands present on this page are imported.
 *
 * On failure we strip both the token and the `data-island-ssr` attribute so the
 * client cleanly falls back to a client-only mount (no hydration mismatch).
 */
async function fillSsrIslands(htmlBody: string): Promise<string> {
  const pending = getSsrIslands();
  if (pending.length === 0) return htmlBody;

  let renderToString: (el: any) => string;
  let createElement: (type: any, props: any) => any;
  try {
    [{ renderToString }, { createElement }] = await Promise.all([
      import('react-dom/server'),
      import('react'),
    ]);
  } catch (err) {
    console.error('[l5e-island] SSR requires react-dom/server + react:', err);
    // Strip every pending token/attr → client-only fallback for all.
    for (const island of pending) {
      htmlBody = htmlBody
        .replace(`<!--${island.token}-->`, '')
        .replace(` data-island-ssr="${island.token}"`, '');
    }
    return htmlBody;
  }

  for (const island of pending) {
    try {
      const loader = islandModules['/' + island.src];
      if (!loader) {
        throw new Error(`island module not found in glob: /${island.src}`);
      }
      const mod: any = await loader();
      const Component = mod[island.name] ?? mod.default;
      if (!Component) {
        throw new Error(`no export "${island.name}" or default in /${island.src}`);
      }
      const out = renderToString(createElement(Component, island.props));
      // Replacer fn (not a string) so `$`-sequences in `out` (e.g. "$&", "$$")
      // aren't interpreted as special replacement patterns.
      htmlBody = htmlBody
        .replace(`<!--${island.token}-->`, () => out)
        .replace(`data-island-ssr="${island.token}"`, 'data-island-ssr="1"');
    } catch (err) {
      console.error(`[l5e-island] Failed to SSR island "${island.name}":`, err);
      htmlBody = htmlBody
        .replace(`<!--${island.token}-->`, '')
        .replace(` data-island-ssr="${island.token}"`, '');
    }
  }

  return htmlBody;
}

export interface RawResponse {
  body: string | Buffer;
  contentType: string;
  statusCode?: number;
  headers?: Record<string, string>;
}

export interface RenderResult {
  html?: string;
  scripts?: string[];
  styles?: string[];
  islands?: Array<{ key: string; src: string; name: string }>;
  head?: string;
  lang?: string;
  statusCode?: number;
  maxAge?: number;
  sMaxAge?: number;
  swr?: number;
  cacheTags?: string[];
  redirect?: { url: string; statusCode: number };
  rawResponse?: RawResponse;
  rawHtml?: boolean;
}

export interface RequestInfo {
  url?: URL;
  path?: string;
  pathname?: string;
  method?: string;
  headers?: Record<string, any>;
  cookies?: Record<string, string>;
  query?: Record<string, any>;
  ip?: string;
  locals?: Record<string, unknown>;
  params?: Record<string, any>;
}

export type RouteResult =
  | string
  | null
  | { view: string; params?: Record<string, any> };

// SchemaMarkup type - có thể là single schema hoặc array of schemas
// Sử dụng any để tương thích với schema-dts types từ frontend
export type SchemaMarkup = any | Array<any>;

export interface LoaderResult {
  props?: Record<string, any>;
  lang?: string;
  maxAge?: number;
  sMaxAge?: number;
  swr?: number;
  cacheTags?: string[] | Record<string, boolean>;
  rawResponse?: RawResponse;
  rawHtml?: boolean;
}

export type LoaderFunction = (requestInfo: RequestInfo) => Promise<LoaderResult>;

export type GenerateMetadataFunction = (requestInfo: RequestInfo, props: any) => Metadata | null;

export type GenerateSchemaFunction = (requestInfo: RequestInfo, props: any) => SchemaMarkup | null;

export interface GlobalLoaderModule {
  loader: LoaderFunction;
  generateMetadata?: GenerateMetadataFunction;
  generateSchema?: GenerateSchemaFunction;
  shouldIgnore?: (viewName: string) => boolean;
}

/**
 * Helper function to render error view
 */
async function renderErrorView(err: HttpException, lang?: string): Promise<RenderResult> {
  const errorViewName = `_error`;
  const errorComponentPath = `/src/views/${errorViewName}/index.tsx`;

  // Set error view name in context
  setViewName(errorViewName);

  // Try to load error view
  const errorComponentModule = viewComponents[errorComponentPath]
    ? await viewComponents[errorComponentPath]()
    : null;

  if (errorComponentModule?.default) {
    // Render error view with exception data
    const errorProps = {
      statusCode: err.statusCode,
      message: err.message,
      data: err.data,
    };

    const Component = errorComponentModule.default;
    const htmlBody = renderJsxToHtmlString(h(Component, errorProps));
    const clientEntries = getClientJsEntries();
    const cssEntries = getCssEntries();
    const headContent = getHeadContent();

    const headHtml =
      headContent.length > 0
        ? headContent.map((content) => renderJsxToHtmlString(content)).join('\n    ')
        : undefined;

    return {
      html: htmlBody,
      scripts: clientEntries.map((entry) => entry.path),
      styles: cssEntries.map((entry) => entry.path),
      head: headHtml,
      lang,
      statusCode: err.statusCode,
    };
  } else {
    // No error view found, render default error message
    const html = h('div', {}, `${err.statusCode} - ${err.message}`);
    return {
      html: renderJsxToHtmlString(html),
      statusCode: err.statusCode,
    };
  }
}

export async function render(url: string, requestInfo: RequestInfo = {}): Promise<RenderResult> {
  return runInRenderContext(async () => {
    try {
      // Step 1: Call route handler to get view name
      const rawRouteResult: RouteResult = await routeHandler(requestInfo);

      if (!rawRouteResult) {
        // Throw NotFoundException to render error_404 view
        throw new NotFoundException('Page not found', {
          path: requestInfo.path,
          pathname: requestInfo.pathname,
          url: requestInfo.url?.href,
        });
      }

      const viewName =
        typeof rawRouteResult === 'string' ? rawRouteResult : rawRouteResult.view;
      requestInfo.params =
        typeof rawRouteResult === 'string' ? {} : (rawRouteResult.params ?? {});

      // Set view name in render context
      setViewName(viewName);

      // Step 2: Load global loader (optional)
      let globalProps: Record<string, any> = {};
      let lang: string | undefined;

      // Try to load global loader
      const globalLoaderPathTs = '/src/global-loader.ts';

      const globalLoaderModule: GlobalLoaderModule | null = globalLoader[globalLoaderPathTs]
        ? await globalLoader[globalLoaderPathTs]()
        : null;

      // Run global loader if exists and not ignored
      if (globalLoaderModule?.loader) {
        const shouldIgnore = globalLoaderModule.shouldIgnore?.(viewName) || false;

        if (!shouldIgnore) {
          const globalLoaderResult = await globalLoaderModule.loader(requestInfo);

          globalProps = globalLoaderResult.props || {};
          lang = globalLoaderResult.lang; // Extract lang from global loader

          if (globalLoaderResult.cacheTags) {
            addCacheTag(globalLoaderResult.cacheTags);
          }

          // generateMetadata và generateSchema sẽ được gọi sau khi có props
        } else {
          console.info(`Global loader ignored for view: ${viewName}`);
        }
      }

      // Step 3: Dynamic import view loader (optional)
      let viewProps: Record<string, any> = {};
      let maxAge: number | undefined;
      let sMaxAge: number | undefined;
      let swr: number | undefined;
      let rawHtml: boolean = false;
      const loaderPathTs = `/src/views/${viewName}/loader.ts`;

      // Try TypeScript loader formats only
      const loaderModule = viewLoaders[loaderPathTs] ? await viewLoaders[loaderPathTs]() : null;

      if (loaderModule?.loader) {
        const loaderResult = await loaderModule.loader(requestInfo);

        // Check if loader returns raw response
        if (loaderResult.rawResponse) {
          return {
            rawResponse: loaderResult.rawResponse,
            statusCode: loaderResult.rawResponse.statusCode || 200,
          };
        }

        viewProps = loaderResult.props || {};
        maxAge = loaderResult.maxAge;
        sMaxAge = loaderResult.sMaxAge;
        swr = loaderResult.swr;
        rawHtml = loaderResult.rawHtml || false;

        if (loaderResult.cacheTags) {
          addCacheTag(loaderResult.cacheTags);
        }

        // View loader lang overrides global loader lang
        if (loaderResult.lang) {
          lang = loaderResult.lang;
        }
      } else {
        console.info(`No loader for view: ${viewName}`);
      }

      // Merge props: global props first, then view props (view can override)
      const props = { ...globalProps, ...viewProps };

      // Step 3.5: Generate metadata và schema từ generateMetadata và generateSchema functions
      // Global generateMetadata (parent metadata)
      if (globalLoaderModule?.generateMetadata) {
        const globalMetadata = globalLoaderModule.generateMetadata(requestInfo, props);
        if (globalMetadata) {
          pushMetadata(globalMetadata);
        }
      }

      // View generateMetadata (child metadata, sẽ merge với parent)
      if (loaderModule?.generateMetadata) {
        const viewMetadata = loaderModule.generateMetadata(requestInfo, props);
        if (viewMetadata) {
          pushMetadata(viewMetadata);
        }
      }

      // Global generateSchema (base schemas)
      if (globalLoaderModule?.generateSchema) {
        const globalSchema = globalLoaderModule.generateSchema(requestInfo, props);
        if (globalSchema) {
          pushSchema(globalSchema);
        }
      }

      // View generateSchema (view-specific schemas)
      if (loaderModule?.generateSchema) {
        const viewSchema = loaderModule.generateSchema(requestInfo, props);
        if (viewSchema) {
          pushSchema(viewSchema);
        }
      }

      // Step 4: Dynamic import component (required)
      const componentPathTsx = `/src/views/${viewName}/index.tsx`;

      const componentModule = viewComponents[componentPathTsx]
        ? await viewComponents[componentPathTsx]()
        : null;

      const Component = componentModule?.default;

      if (!Component) {
        console.error(`View component not found: ${viewName}`);

        // Check if in development or production mode
        const isDevelopment = process.env.NODE_ENV !== 'production';

        if (isDevelopment) {
          // Development: provide detailed error information
          throw new InternalServerErrorException(`View component not found: "${viewName}"`, {
            viewName,
            expectedPath: componentPathTsx,
            availableViews: Object.keys(viewComponents),
            hint: `Make sure the view component exists at ${componentPathTsx} and exports a default component`,
            timestamp: new Date().toISOString(),
          });
        } else {
          // Production: simple error message
          throw new InternalServerErrorException('Internal Server Error');
        }
      }

      // Auto-render MetadataRenderer trước khi render component
      // MetadataRenderer sẽ push metadata vào headRegistry thông qua Head component
      renderJsxToHtmlString(h(MetadataRenderer, {}));

      // Auto-render schemas vào headRegistry
      const schemas = getSchemas();
      schemas.forEach((schema) => {
        // serialize-javascript escapes HTML-sensitive chars (<, >, &, U+2028/2029)
        // so schema values cannot break out of the <script> block (XSS).
        const schemaJson = serialize(schema, { isJSON: true });
        // Push schema vào headRegistry thông qua Head component
        // Head component chỉ push vào registry, không cần renderJsxToHtmlString
        Head({
          priority: HEAD_PRIORITY.SEO,
          children: h('script', {
            type: 'application/ld+json',
            setHtml: schemaJson,
          }),
        });
      });

      // Render component (có thể có Head components khác)
      let htmlBody = renderJsxToHtmlString(h(Component, props));
      // Fill any opt-in `ssr` island placeholders with server-rendered React HTML.
      htmlBody = await fillSsrIslands(htmlBody);
      const clientEntries = getClientJsEntries();
      const cssEntries = getCssEntries();
      const islandEntries = getIslandEntries();
      const cacheTags = getCacheTags();
      const headContent = getHeadContent();

      // Render head content to HTML string
      const headHtml =
        headContent.length > 0
          ? headContent.map((content) => renderJsxToHtmlString(content)).join('\n    ')
          : undefined;

      return {
        html: htmlBody,
        scripts: clientEntries.map((entry) => entry.path),
        styles: cssEntries.map((entry) => entry.path),
        islands: islandEntries.length > 0 ? islandEntries : undefined,
        head: headHtml,
        lang,
        maxAge,
        sMaxAge,
        swr,
        cacheTags,
        rawHtml,
      };
    } catch (err: any) {
      // Handle RedirectException
      if (err instanceof RedirectException) {
        return {
          html: '',
          redirect: {
            url: err.url,
            statusCode: err.statusCode,
          },
        };
      }

      // Handle HttpException
      if (err instanceof HttpException) {
        return await renderErrorView(err);
      }

      // For other (unexpected) errors, convert to ServiceUnavailableException.
      // Intentional HttpExceptions above keep their developer-authored message;
      // but an unexpected error's raw message/stack must not leak to the client
      // in production (it can carry internals, secrets, etc.). Dev keeps detail.
      console.error(`Failed to render:`, err);
      const isProduction = process.env.NODE_ENV === 'production';
      const serviceError = isProduction
        ? new ServiceUnavailableException('Internal Server Error')
        : new ServiceUnavailableException(err.message || 'Internal Server Error', {
            originalError: err.name,
            stack: err.stack,
            timestamp: new Date().toISOString(),
          });
      return await renderErrorView(serviceError);
    }
  }, requestInfo);
}
