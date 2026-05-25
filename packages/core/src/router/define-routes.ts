import { match as p2rMatch, type MatchFunction } from 'path-to-regexp';
import { BadRequestException } from '../core/exceptions';
import type { RequestInfo } from '../core/entry-server';
import { compareSpecificity, pathSpecificity, type Specificity } from './specificity';

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
  parse: (raw: Record<string, string | string[]>) => TParams;
};

export type RouteParamsConfig = {
  parse?: (raw: Record<string, string | string[]>) => Record<string, any>;
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
  matchFn: MatchFunction<Record<string, string | string[]>>;
  specificity: Specificity;
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
    let matchFn: MatchFunction<Record<string, string | string[]>>;
    try {
      matchFn = p2rMatch<Record<string, string | string[]>>(entry.path);
    } catch (err) {
      throw new TypeError(
        `defineRoutes: invalid path "${entry.path}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return { entry, matchFn, specificity: pathSpecificity(entry.path) };
  });

  compiled.sort((a, b) => compareSpecificity(a.specificity, b.specificity));

  return async function routeHandler(
    requestInfo: RequestInfo,
  ): Promise<RouteHandlerResult> {
    const pathname = requestInfo.pathname ?? '/';

    for (const { entry, matchFn } of compiled) {
      const result = matchFn(pathname);
      if (!result) continue;

      let params: Record<string, any> = result.params;
      // `parse` wins over `schema` when both are set (most explicit escape hatch).
      const validator =
        entry.params?.parse ?? entry.params?.schema?.parse.bind(entry.params.schema);
      if (validator) {
        try {
          params = validator(params as Record<string, string | string[]>);
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
