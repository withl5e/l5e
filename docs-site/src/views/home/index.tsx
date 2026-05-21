import { Fragment, useCss } from '@withl5e/l5e/jsx-runtime';

import { MainMenu } from '~/shared/main-menu/MainMenu';

const FIRST_DOC_HREF = '/docs/why-l5e';
const GITHUB_URL = 'https://github.com/withl5e/l5e';

const FEATURES: { tag: string; title: string; body: string }[] = [
  {
    tag: '0 kb',
    title: 'Ship 0 KB JS by default',
    body:
      'A page without an island, useClientJs, or swap+action emits zero <script> tags. No framework runtime, no hydration payload — just HTML.',
  },
  {
    tag: 'render',
    title: 'Per-request bundling',
    body:
      'useCss / useClientJs / island calls register into an AsyncLocalStorage context. Only rendered blocks contribute to the response.',
  },
  {
    tag: 'output',
    title: 'One link, one script',
    body:
      'When JS is needed, it ships as one bundled chunk. No inline blobs, no per-block tag spam, no waterfalls.',
  },
  {
    tag: 'ssr',
    title: 'All-or-nothing',
    body:
      'Render the whole page or fail clearly. No streaming, no half-rendered shells reaching the crawler.',
  },
  {
    tag: 'cache',
    title: 'CDN-native headers',
    body:
      'Loaders set max-age, s-maxage, swr, and Cache-Tag. The CDN handles fan-out, not the framework.',
  },
  {
    tag: 'interactivity',
    title: 'Islands, swap, useClientJs',
    body:
      'Vanilla DOM, swap+action fragments, or React islands — pick the lightest hammer for the spot.',
  },
  {
    tag: 'platform',
    title: 'Plain Express + Vite',
    body:
      'No bespoke routing DSL. Middleware, loaders, actions are first-class TypeScript you can read top-to-bottom.',
  },
];

export default function HomePage() {
  useCss('/src/views/home/styles.css');

  return (
    <Fragment>
      <MainMenu />

      <main class="landing">
        <section class="hero" aria-labelledby="hero-title">
          <div class="hero__copy">
            <div class="hero__pill">
              <span class="hero__pill-dot" aria-hidden="true" />
              0 KB JS by default · runtime bundling · alpha
            </div>
            <h1 id="hero-title" class="hero__title">
              Ship 0 KB JS by default.
              <br />
              <span class="hero__title-accent">When you do ship — only what rendered.</span>
            </h1>
            <p class="hero__lead">
              L5E is an HTML-first SSR framework for block-builder MPAs. Pages without an island
              or <code>useClientJs</code> emit <strong>zero script tags</strong>. When you opt in,
              the framework tracks each call inside a per-request context and bundles only those
              assets — one CSS link, one script tag, sized to what actually rendered.
            </p>
            <div class="hero__cta">
              <a class="btn btn--primary" href={FIRST_DOC_HREF}>
                Read the docs
                <span aria-hidden="true">→</span>
              </a>
              <a class="btn btn--ghost" href={GITHUB_URL} rel="noreferrer">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path
                    fill-rule="evenodd"
                    d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
                  />
                </svg>
                GitHub
              </a>
            </div>
            <pre class="hero__snippet" aria-label="Install command">
              <span class="hero__snippet-prompt">$</span> npm create l5e@alpha my-app -- --template
              basic
            </pre>
          </div>

          <div class="hero__visual" aria-hidden="true">
            <div class="terminal">
              <div class="terminal__bar">
                <span class="terminal__dot terminal__dot--red" />
                <span class="terminal__dot terminal__dot--yellow" />
                <span class="terminal__dot terminal__dot--green" />
                <span class="terminal__file">GET /landing</span>
              </div>
              <div class="terminal__body">
                <div class="terminal__line">
                  <span class="terminal__prompt">→</span> render &lt;Page&gt; composed of 12 blocks
                </div>
                <div class="terminal__line terminal__line--muted">
                  &nbsp;&nbsp;blocks rendered:{' '}
                  <span class="terminal__chip">Hero</span>{' '}
                  <span class="terminal__chip">Pricing</span>{' '}
                  <span class="terminal__chip">FAQ</span>
                </div>
                <div class="terminal__line terminal__line--muted">
                  &nbsp;&nbsp;blocks skipped: 9
                </div>
                <div class="terminal__line">
                  <span class="terminal__prompt">→</span> registered:{' '}
                  <span class="terminal__ok">3 CSS</span> ·{' '}
                  <span class="terminal__ok">2 JS</span>
                </div>
                <div class="terminal__line">
                  <span class="terminal__prompt">→</span> bundled at runtime
                </div>
                <div class="terminal__line terminal__line--ok">
                  &nbsp;&nbsp;✓ /bundle-k4m9p2.css <span class="terminal__muted">4.1 KB</span>
                </div>
                <div class="terminal__line terminal__line--ok">
                  &nbsp;&nbsp;✓ /bundle-x7y2b1.js <span class="terminal__muted">6.3 KB</span>
                </div>
                <div class="terminal__line terminal__line--muted">
                  &nbsp;&nbsp;200 OK · 18 ms
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="viz" aria-labelledby="viz-title">
          <div class="viz__heading">
            <p class="viz__eyebrow">Static tooling can't see your runtime composition</p>
            <h2 id="viz-title">
              12 blocks possible. 3 actually render. <br />
              <span class="viz__heading-accent">Watch what each strategy ships.</span>
            </h2>
          </div>

          <div class="viz__grid">
            <article class="viz-col viz-col--alt" aria-labelledby="viz-a">
              <header class="viz-col__head">
                <span class="viz-col__tag">Strategy A</span>
                <h3 id="viz-a">Single big bundle</h3>
              </header>
              <div class="viz-stage" aria-hidden="true">
                <div class="viz-bundle">
                  <span class="viz-tile viz-tile--on" />
                  <span class="viz-tile viz-tile--on" />
                  <span class="viz-tile viz-tile--on" />
                  <span class="viz-tile viz-tile--off" />
                  <span class="viz-tile viz-tile--off" />
                  <span class="viz-tile viz-tile--off" />
                  <span class="viz-tile viz-tile--off" />
                  <span class="viz-tile viz-tile--off" />
                  <span class="viz-tile viz-tile--off" />
                  <span class="viz-tile viz-tile--off" />
                  <span class="viz-tile viz-tile--off" />
                  <span class="viz-tile viz-tile--off" />
                </div>
              </div>
              <footer class="viz-col__foot">
                <span class="viz-col__metric">92 KB</span>
                <span class="viz-col__hint">3 used · 9 dead weight</span>
              </footer>
            </article>

            <article class="viz-col viz-col--alt" aria-labelledby="viz-b">
              <header class="viz-col__head">
                <span class="viz-col__tag">Strategy B</span>
                <h3 id="viz-b">Many tags in the HTML</h3>
              </header>
              <div class="viz-stage" aria-hidden="true">
                <div class="viz-scatter">
                  <span class="viz-pill viz-pill--on">js</span>
                  <span class="viz-pill viz-pill--on">css</span>
                  <span class="viz-pill viz-pill--on">js</span>
                  <span class="viz-pill viz-pill--off">js</span>
                  <span class="viz-pill viz-pill--off">css</span>
                  <span class="viz-pill viz-pill--off">js</span>
                  <span class="viz-pill viz-pill--off">css</span>
                  <span class="viz-pill viz-pill--off">js</span>
                  <span class="viz-pill viz-pill--off">css</span>
                  <span class="viz-pill viz-pill--off">js</span>
                  <span class="viz-pill viz-pill--off">css</span>
                  <span class="viz-pill viz-pill--off">js</span>
                </div>
              </div>
              <footer class="viz-col__foot">
                <span class="viz-col__metric">24 tags</span>
                <span class="viz-col__hint">round-trips or inline blobs</span>
              </footer>
            </article>

            <article class="viz-col viz-col--good" aria-labelledby="viz-c">
              <header class="viz-col__head">
                <span class="viz-col__tag viz-col__tag--good">L5E</span>
                <h3 id="viz-c">Bundle what rendered</h3>
              </header>
              <div class="viz-stage" aria-hidden="true">
                <div class="viz-flow">
                  <div class="viz-flow__row">
                    <span class="viz-tile viz-tile--on" />
                    <span class="viz-tile viz-tile--on" />
                    <span class="viz-tile viz-tile--on" />
                  </div>
                  <div class="viz-flow__arrow">
                    <span class="viz-flow__dot" />
                  </div>
                  <div class="viz-flow__row">
                    <span class="viz-bundle-out">
                      <span class="viz-bundle-out__line" />
                      <span class="viz-bundle-out__line" />
                    </span>
                  </div>
                </div>
              </div>
              <footer class="viz-col__foot">
                <span class="viz-col__metric viz-col__metric--good">10 KB</span>
                <span class="viz-col__hint">1 link · 1 script</span>
                <span class="viz-col__hint viz-col__hint--alt">↳ 0 KB JS · 0 script tags if static</span>
              </footer>
            </article>
          </div>

          <p class="viz__caption">
            Strategy A &amp; B are what build-time tooling must choose between when a route's
            composition is dynamic. L5E watches what your render pass actually touched and bundles
            that — nothing more.
          </p>
        </section>

        <section class="features" aria-labelledby="features-title">
          <h2 id="features-title" class="section-title">
            <span class="section-title__num">02</span>
            What it gives you
          </h2>
          <div class="features__grid">
            {FEATURES.map((feature) => (
              <article class="feature">
                <span class="feature__tag">{feature.tag}</span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section class="cta-strip" aria-labelledby="cta-title">
          <h2 id="cta-title">Build a page the size it deserves.</h2>
          <p>
            L5E is alpha. Read the docs, try the basic template, file issues — feedback shapes
            v0.2.
          </p>
          <div class="cta-strip__actions">
            <a class="btn btn--primary" href={FIRST_DOC_HREF}>
              Open the docs
              <span aria-hidden="true">→</span>
            </a>
            <a class="btn btn--ghost" href={GITHUB_URL} rel="noreferrer">
              Star on GitHub
            </a>
          </div>
        </section>
      </main>

      <footer class="site-footer">
        <span>L5E · MIT licensed · v0.1.1-alpha</span>
        <span class="site-footer__links">
          <a href={GITHUB_URL} rel="noreferrer">
            GitHub
          </a>
          <a href="https://www.npmjs.com/package/@withl5e/l5e" rel="noreferrer">
            npm
          </a>
          <a href={FIRST_DOC_HREF}>Docs</a>
        </span>
      </footer>
    </Fragment>
  );
}
