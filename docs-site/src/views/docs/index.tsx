import { Fragment, useClientJs, useCss } from '@withl5e/l5e/jsx-runtime';

import { Footer } from '~/shared/footer/Footer';
import { MainMenu } from '~/shared/main-menu/MainMenu';

import type { DocsPageProps } from './loader';

export default function DocsPage({
  html,
  toc,
  sourcePath,
  currentSlug,
  navGroups,
  previous,
  next,
}: DocsPageProps) {
  useCss('/src/views/docs/styles.css');
  useCss('/src/features/syntax-highlight/styles.css');
  useClientJs('/src/views/docs/scrollspy.client.ts');

  const activeItem = navGroups.flatMap((g) => g.items).find((i) => i.slug === currentSlug);
  const activeLabel = activeItem ? `${activeItem.section} · ${activeItem.title}` : 'Menu';

  return (
    <Fragment>
      <MainMenu />
      <div class="docs-layout">
        <aside class="docs-sidebar" aria-label="L5E documentation">
          <input
            type="checkbox"
            id="docs-menu-toggle"
            class="docs-menu-toggle"
            aria-hidden="true"
          />
          <label class="docs-menu-summary" for="docs-menu-toggle">
            <span class="docs-menu-summary__label">{activeLabel}</span>
            <span class="docs-menu-summary__chev" aria-hidden="true">
              ▾
            </span>
          </label>
          <nav class="docs-nav" aria-label="Documentation pages">
            {navGroups.map((group) => (
              <section class="docs-nav__group">
                <h2>{group.section}</h2>
                <ul>
                  {group.items.map((item) => (
                    <li>
                      <a
                        href={item.href}
                        aria-current={item.slug === currentSlug ? 'page' : undefined}
                      >
                        {item.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </nav>
        </aside>

        <main class="docs-main">
          <div class="docs-meta">
            <span>L5E docs</span>
            <code>{sourcePath}</code>
          </div>
          <article class="docs-content" setHtml={html} />
          <nav class="docs-pagination" aria-label="Documentation pages">
            {previous ? (
              <a class="docs-pagination__link docs-pagination__link--prev" href={previous.href}>
                <span>Previous</span>
                {previous.title}
              </a>
            ) : (
              <span />
            )}
            {next ? (
              <a class="docs-pagination__link docs-pagination__link--next" href={next.href}>
                <span>Next</span>
                {next.title}
              </a>
            ) : (
              <span />
            )}
          </nav>
        </main>

        {toc.length > 0 ? (
          <aside class="docs-toc" aria-label="On this page">
            <p class="docs-toc__label">On this page</p>
            <nav class="docs-toc__nav">
              <ul>
                {toc.map((item) => (
                  <li class={item.depth === 3 ? 'docs-toc__item--sub' : undefined}>
                    <a href={`#${item.id}`}>{item.text}</a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        ) : null}
      </div>
      <Footer />
    </Fragment>
  );
}
