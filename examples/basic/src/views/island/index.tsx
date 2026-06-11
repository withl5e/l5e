import { ClientIsland } from '@withl5e/l5e/island';
import { Fragment } from '@withl5e/l5e/jsx-runtime';

export default function IslandPage() {
  return (
    <Fragment>
      <nav class="nav" aria-label="Primary">
        <a href="/">Home</a>
        <a href="/island">Island SSR</a>
      </nav>
      <main>
        <section class="panel">
          <h1>Island SSR demo</h1>

          <h2>ssr (server-rendered + hydrated)</h2>
          <ClientIsland
            from="./react/Counter"
            ssr
            props={{ initCount: 5, label: 'Total: $$42' }}
            class="ssr-island"
          />

          <h2>client-only (default mount)</h2>
          <ClientIsland from="./react/Counter" props={{ initCount: 0 }} class="csr-island" />
        </section>
      </main>
    </Fragment>
  );
}
