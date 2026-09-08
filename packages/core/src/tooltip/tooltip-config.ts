import type { Placement } from '@floating-ui/dom';

export type TooltipHost = HTMLElement & {
  dataset: {
    tooltipId: string;
    tooltipType?: string;
    tooltipPlacement?: Placement;
    href?: string;
  };
};

/** Everything the tooltip system knows about one request, for a custom strategy to build a URL from. */
export interface TooltipUrlContext {
  type: string;
  id: string;
  host: TooltipHost;
}

export type TooltipUrlStrategy = (ctx: TooltipUrlContext) => string;

const defaultStrategy: TooltipUrlStrategy = ({ type, id }) => `/tooltip/${type}/${id}`;

/**
 * If the page's own URL already carries a prefix matching `<html lang>` (e.g.
 * `<html lang="vi">` on `/vi/...`), reuse that same prefix — for apps doing
 * URL-prefix locale routing that want each locale to be a distinct,
 * CDN-cacheable tooltip URL with zero per-page setup. A base-locale page
 * (unprefixed URL) naturally infers no prefix.
 */
const autoLocaleStrategy: TooltipUrlStrategy = ({ type, id }) => {
  const lang = document.documentElement.lang;
  let prefix = '';
  if (lang) {
    const primary = lang.split('-')[0].toLowerCase();
    const match = location.pathname.match(/^\/([a-zA-Z-]+)(?:\/|$)/);
    const segment = match?.[1];
    if (
      segment &&
      (segment.toLowerCase() === primary || segment.toLowerCase() === lang.toLowerCase())
    ) {
      prefix = `/${segment}`;
    }
  }
  return `${prefix}/tooltip/${type}/${id}`;
};

declare global {
  interface Window {
    // L5E's per-request bundler compiles each view's client script (and
    // client.global.ts) as independent bundles — a view that imports
    // initTooltips()/showTooltip() gets its own inlined copy of this whole
    // module, with its own module-scoped variables. A plain `let` here
    // would only ever be seen by whichever single bundle happens to define
    // it, not by the others — so this has to live on `window`, the one
    // thing every independently-bundled script actually shares.
    __l5eTooltipUrl?: TooltipUrlStrategy;
  }
}

/**
 * Replace how every tooltip's fetch URL is built. L5E is not an i18n
 * framework and most apps using tooltips don't localize URLs (or need any
 * custom scheme) at all, so the default is `/tooltip/:type/:id` unless an
 * app opts into something else — call this once at startup, e.g. in
 * `client.global.ts` so it runs regardless of which view's own client
 * script actually mounts a tooltip:
 *
 * ```ts
 * configureTooltip('auto-locale'); // infer /vi (or none) from <html lang> + URL
 * // or fully custom:
 * configureTooltip(({ type, id }) => `/api/v2/tooltips/${type}-${id}`);
 * ```
 */
export function configureTooltip(strategy: 'auto-locale' | TooltipUrlStrategy): void {
  window.__l5eTooltipUrl = strategy === 'auto-locale' ? autoLocaleStrategy : strategy;
}

export function tooltipUrl(host: TooltipHost): string {
  const { tooltipId: id, tooltipType: type } = host.dataset;
  const strategy = window.__l5eTooltipUrl ?? defaultStrategy;
  return strategy({ type: type ?? '', id: id ?? '', host });
}
