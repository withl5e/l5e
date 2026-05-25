import { Fragment, useRequest } from '@withl5e/l5e/jsx-runtime';

import type { BlogLoaderData } from './loader';

export default function BlogPost({ slug }: BlogLoaderData) {
  const { params } = useRequest();
  return (
    <Fragment>
      <nav class="nav" aria-label="Primary">
        <a href="/">Home</a>
        <a href="/blog/hello-world">/blog/hello-world</a>
        <a href="/docs/getting-started/install">/docs/...</a>
      </nav>
      <main>
        <section class="panel">
          <h1>Blog post</h1>
          <p>
            From loader: <code data-testid="slug-loader">{slug}</code>
          </p>
          <p>
            From useRequest(): <code data-testid="slug-hook">{String(params.slug)}</code>
          </p>
        </section>
      </main>
    </Fragment>
  );
}
