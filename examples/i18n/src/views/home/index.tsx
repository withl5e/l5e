import { Fragment, useClientJs } from '@withl5e/l5e/jsx-runtime';
import { ClientIsland } from '@withl5e/l5e/island';
import { getLocale, locales, localizeHref } from '~/paraglide/runtime.js';
import type { Locale } from '~/paraglide/runtime.js';
import { m } from '~/paraglide/messages.js';
import { LocaleBadge } from '~/components/LocaleBadge';

import type { HomeLoaderData } from './loader';

const LOCALE_LABELS: Record<string, string> = { en: 'English', vi: 'Tiếng Việt' };

/** '' for the base locale, '/vi' for others — same scheme as page URLs. */
function tooltipBasePath(locale: Locale): string {
  const localizedRoot = localizeHref('/', { locale });
  return localizedRoot === '/' ? '' : localizedRoot.replace(/\/$/, '');
}

export default function HomePage({ pathname }: HomeLoaderData) {
  useClientJs('/src/views/home/client.ts');

  const locale = getLocale();

  return (
    <Fragment>
      <main>
        <section class="panel home-panel">
          <h1>{m.greeting()}</h1>
          <p data-testid="current-locale">Current locale: {locale}</p>
          {/* Read straight from requestInfo in loader.ts — not from getLocale() —
              just to show a loader can use either. */}
          <p data-testid="current-pathname">Pathname (from requestInfo): {pathname}</p>

          <nav aria-label={m.switch_language()}>
            {locales.map((loc) => (
              <a
                key={loc}
                href={localizeHref('/', { locale: loc })}
                data-testid={`switch-${loc}`}
                aria-current={loc === locale ? 'true' : undefined}
              >
                {LOCALE_LABELS[loc] ?? loc}
              </a>
            ))}
          </nav>

          <LocaleBadge />

          <section aria-label="Server action demo">
            <button type="button" data-load-greeting data-testid="load-greeting-button">
              {m.action_button_label()}
            </button>
            <p>
              <span data-swap-target="action-result" data-testid="action-result">
                —
              </span>
            </p>
          </section>

          <section aria-label="Tooltip demo">
            {/* data-tooltip-base makes the fetch go to /tooltip/... (base
                locale) or /vi/tooltip/... — a distinct, CDN-cacheable URL per
                locale, resolved via the same 'url' strategy as any page. */}
            <span
              data-tooltip-id="1"
              data-tooltip-type="demo"
              data-tooltip-base={tooltipBasePath(locale)}
              data-testid="tooltip-trigger"
              tabindex={0}
            >
              {m.tooltip_trigger_label()}
            </span>
          </section>

          <section aria-label="React island demo">
            <h2>{m.ssr_island_label()}</h2>
            {/* React runs in the browser with no AsyncLocalStorage, so locale
                has to be passed as an explicit prop here — the one deliberate
                exception to ambient getLocale() in this whole demo. */}
            <ClientIsland
              from="./react/LocaleCounter"
              ssr
              props={{ locale, initCount: 5, testId: 'ssr-island-count' }}
              class="ssr-island"
            />

            <h2>{m.csr_island_label()}</h2>
            <ClientIsland
              from="./react/LocaleCounter"
              props={{ locale, initCount: 0, testId: 'csr-island-count' }}
              class="csr-island"
            />
          </section>
        </section>
      </main>
    </Fragment>
  );
}
