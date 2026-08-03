import { Fragment, useClientJs, useCss } from '@withl5e/l5e/jsx-runtime';

// A shared component registers its own assets. Rendering it more than once on a
// page — on top of the page itself asking for the same files — must still emit a
// single <link> and a single <script>.
function Card({ title }: { title: string }) {
  useCss('/src/views/asset-dedupe/asset-dedupe.css');
  useClientJs('/src/views/asset-dedupe/client.ts');

  return (
    <section class="dedupe-card">
      <h2>{title}</h2>
      <p data-dedupe-card>waiting for client js</p>
    </section>
  );
}

export default function AssetDedupePage() {
  useCss('/src/views/asset-dedupe/asset-dedupe.css');
  useClientJs('/src/views/asset-dedupe/client.ts');

  return (
    <Fragment>
      <nav class="nav" aria-label="Primary">
        <a href="/">Home</a>
        <a href="/actions">Action + swap</a>
      </nav>
      <main>
        <h1>Asset dedupe</h1>
        <Card title="First card" />
        <Card title="Second card" />
      </main>
    </Fragment>
  );
}
