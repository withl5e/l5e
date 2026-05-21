import { useCss } from '@withl5e/l5e/jsx-runtime';
import { MetadataRenderer } from '@withl5e/l5e/seo';

import type { HomeLoaderData } from './loader';

export default function HomePage({ now }: HomeLoaderData) {
  useCss('src/views/home/home.css');

  return (
    <>
      <MetadataRenderer
        metadata={{
          title: 'L5E basic example',
          description: 'A minimal L5E app with middleware rewrite and cache headers.',
        }}
      />
      <nav class="nav" aria-label="Primary">
        <a href="/">Home</a>
        <a href="/rewrite-demo">Rewrite demo</a>
        <a href="/actions">Action + swap</a>
      </nav>
      <main>
        <section class="panel home-panel">
          <h1>L5E basic example</h1>
          <p>
            This page is server-rendered. Visiting <a href="/rewrite-demo">/rewrite-demo</a>{' '}
            renders the same home page through middleware rewrite.
          </p>
          <p class="timestamp">Rendered at {now}</p>
        </section>
      </main>
    </>
  );
}
