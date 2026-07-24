import type { LoaderFunction } from '@withl5e/l5e/entry-server';

// Global loader owns the document `lang` for every view — per-view loaders
// don't need to resolve or return it themselves (see src/views/home/loader.ts).
//
// Reads `requestInfo.locals.locale` directly rather than calling the ambient
// `getLocale()` — the loader already receives `requestInfo` as its argument,
// and `fromFetchMiddleware` (src/middleware.ts) already wrote the resolved
// locale onto `locals` before this loader ever runs, so there's nothing the
// ambient accessor would tell you that the parameter doesn't already have.
export const loader: LoaderFunction = async (requestInfo) => {
  const locale = (requestInfo.locals?.locale as string | undefined) ?? 'en';
  return { lang: locale };
};
