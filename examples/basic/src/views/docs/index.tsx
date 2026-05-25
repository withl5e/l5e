import { Fragment } from '@withl5e/l5e/jsx-runtime';

import type { DocsLoaderData } from './loader';

export default function DocsPage({ path }: DocsLoaderData) {
  return (
    <Fragment>
      <nav class="nav" aria-label="Primary">
        <a href="/">Home</a>
        <a href="/docs/getting-started/install">/docs/getting-started/install</a>
      </nav>
      <main>
        <section class="panel">
          <h1>Docs splat route</h1>
          <p>
            Captured splat: <code data-testid="splat">{path}</code>
          </p>
        </section>
      </main>
    </Fragment>
  );
}
