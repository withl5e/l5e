import type { GenerateMetadataFunction, LoaderFunction } from '@withl5e/l5e/entry-server';
import { baseLocale, locales, localizeHref } from '~/paraglide/runtime.js';

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

// Also runs for every view automatically — no per-view declaration needed.
// Builds `<link rel="alternate" hreflang="...">` for every configured locale
// from the current (de-localized) path, so search engines always see a
// correct, existing URL for each locale variant of any page in the app.
export const generateMetadata: GenerateMetadataFunction = (requestInfo) => {
  const pathname = requestInfo.pathname ?? '/';
  const origin = requestInfo.url?.origin ?? '';
  const alternateLocales: Record<string, string> = {};
  for (const locale of locales) {
    alternateLocales[locale] = origin + localizeHref(pathname, { locale });
  }
  alternateLocales['x-default'] = origin + localizeHref(pathname, { locale: baseLocale });
  return { alternateLocales };
};
