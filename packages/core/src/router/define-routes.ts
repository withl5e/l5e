import { BadRequestException } from '../core/exceptions';
import type { RequestInfo } from '../core/entry-server';
import { tokenize } from './lexer';
import { compareSpecificity, parse, type RouteAst } from './parser';
import { match, splitPath } from './matcher';

export type RouteHandlerResult =
  | string
  | null
  | { view: string; params?: Record<string, any> };

export type ResolveContext<TParams = Record<string, any>> = {
  params: TParams;
  requestInfo: RequestInfo;
};

export type RouteResolveResult =
  | string
  | null
  | { view: string; params?: Record<string, any> };

export type ParamsSchema<TParams = Record<string, any>> = {
  parse: (raw: Record<string, string>) => TParams;
};

export type RouteParamsConfig = {
  parse?: (raw: Record<string, string>) => Record<string, any>;
  schema?: ParamsSchema;
};

export type RouteEntry = {
  path: string;
  view?: string;
  params?: RouteParamsConfig;
  resolve?: (
    ctx: ResolveContext,
  ) => RouteResolveResult | Promise<RouteResolveResult>;
};

type CompiledRoute = {
  entry: RouteEntry;
  ast: RouteAst;
};

export function defineRoutes(
  routes: RouteEntry[],
): (requestInfo: RequestInfo) => Promise<RouteHandlerResult> {
  if (!Array.isArray(routes)) {
    throw new TypeError('defineRoutes expects an array of route entries');
  }

  const compiled: CompiledRoute[] = routes.map((entry) => {
    if (!entry || typeof entry.path !== 'string') {
      throw new TypeError(
        `defineRoutes: each route must have a string "path" (got ${JSON.stringify(entry)})`,
      );
    }
    if (!entry.view && !entry.resolve) {
      throw new TypeError(
        `defineRoutes: route "${entry.path}" must define either "view" or "resolve"`,
      );
    }
    const tokens = tokenize(entry.path);
    const ast = parse(tokens, entry.path);
    return { entry, ast };
  });

  compiled.sort((a, b) => compareSpecificity(a.ast.specificity, b.ast.specificity));

  return async function routeHandler(
    requestInfo: RequestInfo,
  ): Promise<RouteHandlerResult> {
    const pathname = requestInfo.pathname ?? '/';
    const urlSegments = splitPath(pathname);

    for (const { entry, ast } of compiled) {
      const rawParams = match(ast, urlSegments);
      if (rawParams === null) continue;

      let params: Record<string, any> = rawParams;
      // `parse` wins over `schema` when both are set (most explicit escape hatch).
      const validator = entry.params?.parse ?? entry.params?.schema?.parse.bind(entry.params.schema);
      if (validator) {
        try {
          params = validator(rawParams);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          throw new BadRequestException(`Invalid route params: ${message}`, {
            path: entry.path,
            pathname,
          });
        }
      }

      if (entry.resolve) {
        const resolved = await entry.resolve({ params, requestInfo });
        return normalizeResolveResult(resolved);
      }

      return { view: entry.view!, params };
    }

    return null;
  };
}

function normalizeResolveResult(result: RouteResolveResult): RouteHandlerResult {
  if (result === null || result === undefined) return null;
  if (typeof result === 'string') return { view: result, params: {} };
  return result;
}
