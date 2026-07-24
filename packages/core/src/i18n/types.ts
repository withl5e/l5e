/**
 * The shape shared by fetch-based locale middleware — Paraglide's own
 * `paraglideMiddleware(request, resolve, options?)` matches this exactly, so
 * `fromFetchMiddleware(paraglideMiddleware)` works with zero glue code. Any
 * other library (or hand-written function) exposing the same shape works too.
 */
export interface FetchLocaleMiddleware<TLocale extends string = string, TOptions = unknown> {
  (
    request: Request,
    resolve: (args: { request: Request; locale: TLocale }) => Response | Promise<Response>,
    options?: TOptions,
  ): Response | Promise<Response>;
}
