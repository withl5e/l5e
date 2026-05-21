import { Fragment, useCss } from '@withl5e/l5e/jsx-runtime';

import type { DocsPageProps } from './loader';

export default function DocsPage({
  html,
  sourcePath,
  currentSlug,
  navGroups,
  previous,
  next,
}: DocsPageProps) {
  useCss('/src/views/docs/styles.css');

  return (
    <Fragment>
      <div class="docs-layout">
        <aside class="docs-sidebar" aria-label="L5E documentation">
          <a class="docs-brand" href="/">
            L5E
            <span class="docs-brand__tag">docs</span>
          </a>
          <nav class="docs-nav">
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
      </div>
    </Fragment>
  );
}
