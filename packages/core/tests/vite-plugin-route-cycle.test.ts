import { describe, expect, it } from 'vitest';
import { coreVite } from '../src/core/vite-plugin';

/**
 * Regression: the `virtual:l5e-route` module must load `/src/route.ts` LAZILY
 * (dynamic import inside the handler), not via a static `export ... from`.
 *
 * A static re-export pulls the user's route module — and everything it imports —
 * into entry-server's static SSR graph. Route files routinely import the
 * `@withl5e/l5e` barrel (RedirectException, types, ...), and the barrel
 * re-exports `render` from entry-server, closing an import cycle:
 *   entry-server → virtual:l5e-route → /src/route.ts → @withl5e/l5e → entry-server
 * On the first dev request Vite can run `render()` while entry-server is still
 * suspended awaiting this import, throwing
 *   "Cannot access '__vite_ssr_import_N__' before initialization"
 * (a page reload masks it because the graph is warm). Loading route.ts lazily
 * removes it from entry-server's static graph and breaks the cycle.
 */
function loadVirtual(id: string): string | null {
  const plugin = coreVite();
  const hook = (plugin as any).load;
  const handler = typeof hook === 'function' ? hook : hook.handler;
  const result = handler.call({}, '\0' + id);
  if (result == null) return null;
  return typeof result === 'string' ? result : result.code;
}

describe('virtual:l5e-route breaks the entry-server import cycle', () => {
  it('does NOT statically re-export /src/route.ts', () => {
    const code = loadVirtual('virtual:l5e-route');
    expect(code).not.toBeNull();
    // No static `export ... from '/src/route.ts'` — that is the cycle-closing edge.
    expect(code).not.toMatch(/export\s+\{[^}]*\}\s+from\s+['"]\/src\/route\.ts['"]/);
    expect(code).not.toMatch(/export\s+\*\s+from\s+['"]\/src\/route\.ts['"]/);
  });

  it('imports /src/route.ts lazily via a dynamic import inside the handler', () => {
    const code = loadVirtual('virtual:l5e-route')!;
    // Must default-export a callable handler (entry-server does `await routeHandler(req)`).
    expect(code).toMatch(/export\s+default\s+function/);
    // The only reference to route.ts is a dynamic import().
    expect(code).toMatch(/import\(\s*['"]\/src\/route\.ts['"]\s*\)/);
  });
});
