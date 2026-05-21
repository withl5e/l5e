import { useClientJs, useCss } from '@withl5e/l5e/jsx-runtime';
import { MetadataRenderer } from '@withl5e/l5e/seo';

export default function ActionsPage() {
  useCss('src/views/actions/actions.css');
  useClientJs('src/views/actions/client.ts');

  return (
    <>
      <MetadataRenderer metadata={{ title: 'Action + swap example' }} />
      <nav class="nav" aria-label="Primary">
        <a href="/">Home</a>
        <a href="/rewrite-demo">Rewrite demo</a>
        <a href="/actions">Action + swap</a>
      </nav>
      <main>
        <section class="panel actions-panel">
          <h1>Action + swap</h1>
          <p>
            Click the button to call a server action and swap the returned HTML into the page.
          </p>
          <button class="button" type="button" data-load-time>
            Load server time
          </button>
          <p>
            Current value: <span data-swap-target="server-time">not loaded</span>
          </p>
        </section>
      </main>
    </>
  );
}
