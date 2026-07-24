import type {
  GenerateMetadataFunction,
  GenerateSchemaFunction,
  LoaderFunction,
  LoaderResult,
} from '@withl5e/l5e/entry-server';
import { m } from '~/paraglide/messages.js';
import type { Locale } from '~/paraglide/runtime.js';

const BCP47: Record<Locale, string> = { en: 'en-US', vi: 'vi-VN' };

export type HomeLoaderData = {
  pathname: string;
};

function localeOf(requestInfo: { locals?: Record<string, unknown> }): Locale {
  return (requestInfo.locals?.locale as Locale | undefined) ?? 'en';
}

// `lang` is NOT returned here — src/global-loader.ts already sets it for
// every view via its own requestInfo.locals.locale, so a per-view loader
// only needs to worry about it if it wants to override the global choice
// for one view. This loader instead demonstrates reading `requestInfo`
// directly (the same request-scoped object middleware populates `locals` on).
export const loader: LoaderFunction = async (requestInfo): Promise<LoaderResult> => {
  return {
    props: { pathname: requestInfo.pathname ?? '/' },
  };
};

// generateMetadata and generateSchema both run inside the same request's
// AsyncLocalStorage scope as everything else (they're called from render(),
// itself invoked inside fromFetchMiddleware's next() call) — so `m.xxx()`
// message calls stay plain and ambient, exactly like everywhere else in this
// demo. Never pass `{ locale }` to a message call manually; that's what the
// ambient scope is for. `requestInfo` is only read here for `inLanguage`,
// which needs the raw locale string, not a translated message.
export const generateMetadata: GenerateMetadataFunction = () => ({
  title: m.greeting(),
  description: m.site_description(),
});

export const generateSchema: GenerateSchemaFunction = (requestInfo) => {
  const locale = localeOf(requestInfo);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: m.greeting(),
    description: m.site_description(),
    url: 'https://example.com/',
    inLanguage: BCP47[locale] ?? locale,
  };
};
