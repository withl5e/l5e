import { Fragment, useCss } from '@withl5e/l5e/jsx-runtime';

import type { HomeLoaderData } from './loader';

export default function HomePage({ now }: HomeLoaderData) {
  useCss('/src/views/home/home.css');

  return (
    <Fragment>
      <nav class="nav" aria-label="Primary">
        <a href="/">Home</a>
      </nav>
      <main>
        <section class="panel home-panel">
          <h1>L5E starter</h1>
          <p>This page is server-rendered by L5E.</p>
          <p class="timestamp">Rendered at {now}</p>
        </section>
      </main>
    </Fragment>
  );
}
