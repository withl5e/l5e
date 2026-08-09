import type { IslandMeta } from './types';
import { strategies, registerMountStrategy } from './strategy-registry';

// ============================================================
// PART 1: Built-in strategies
// ============================================================

registerMountStrategy('load', (mount) => {
  mount();
});

registerMountStrategy('idle', (mount) => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => mount());
  } else {
    setTimeout(() => mount(), 200);
  }
});

registerMountStrategy('visible', (mount, opts, el) => {
  const rootMargin = opts || '200px';
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          mount();
        }
      });
    },
    { rootMargin },
  );
  observer.observe(el);
  return () => observer.disconnect();
});

registerMountStrategy('media', (mount, opts) => {
  if (!opts) {
    console.error('[l5e-island] Strategy "media" requires mountOpts (media query)');
    return;
  }
  const mql = window.matchMedia(opts);
  if (mql.matches) {
    mount();
  } else {
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) mount();
    };
    mql.addEventListener('change', handler, { once: true });
    return () => mql.removeEventListener('change', handler);
  }
});

registerMountStrategy('none', () => {
  // Don't mount - keep placeholder as-is
});

// ============================================================
// PART 2: Import custom strategies (if any)
// ============================================================

import 'virtual:l5e-island-strategies';

// ============================================================
// PART 3: Island discovery + mount logic
// ============================================================

// Per-page island registry injected by server.ts as inline script
// Format: { "Counter_a3f2": "/assets/Counter-Abc123.js" }
const islandRegistry: Record<string, string> = (window as any).__L5E_ISLANDS__ || {};

// Props for islands rendered in externalized mode live in a single
// `<script type="application/json" id="_l5e_data_">` at the end of the document
// (keeps the SSR body lean for crawlers). Parsed once, lazily.
let islandDataCache: unknown[] | null = null;
function getIslandData(): unknown[] {
  if (islandDataCache) return islandDataCache;
  const el = document.getElementById('_l5e_data_');
  if (!el || !el.textContent) return (islandDataCache = []);
  try {
    const parsed = JSON.parse(el.textContent);
    islandDataCache = Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[l5e-island] Failed to parse _l5e_data_ props store:', err);
    islandDataCache = [];
  }
  return islandDataCache;
}

function readProps(el: Element): Record<string, unknown> {
  const idx = el.getAttribute('data-island-idx');
  if (idx !== null) {
    return (getIslandData()[Number(idx)] as Record<string, unknown>) || {};
  }
  return JSON.parse(el.getAttribute('data-island-props') || '{}');
}

function discoverIslands(): IslandMeta[] {
  return Array.from(document.querySelectorAll('[data-island]')).map((el) => ({
    element: el as HTMLElement,
    registryKey: el.getAttribute('data-island')!,
    exportName: el.getAttribute('data-island-name')!,
    props: readProps(el),
    mount: el.getAttribute('data-island-mount') || 'load',
    mountOpts: el.getAttribute('data-island-opts') || undefined,
    ssr: el.hasAttribute('data-island-ssr'),
  }));
}

function createMountFn(island: IslandMeta): () => Promise<void> {
  let mounted = false;
  return async () => {
    if (mounted) return;
    mounted = true;

    // Look up component URL from per-page registry
    const url = islandRegistry[island.registryKey];
    if (!url) {
      console.error(
        `[l5e-island] Component "${island.registryKey}" not found in page registry.`,
        `Available: ${Object.keys(islandRegistry).join(', ')}`,
      );
      return;
    }

    try {
      const [reactDomClient, { createElement }, mod] = await Promise.all([
        import('react-dom/client'),
        import('react'),
        import(/* @vite-ignore */ url),
      ]);

      const Component = mod.default || mod[island.exportName];
      if (!Component) {
        console.error(`[l5e-island] No export "default" or "${island.exportName}" in module`);
        return;
      }

      if (island.ssr) {
        // Server already rendered this component into the element → hydrate it.
        reactDomClient.hydrateRoot(island.element, createElement(Component, island.props));
      } else {
        // Client-only mount (default): fresh render into an empty placeholder.
        const root = reactDomClient.createRoot(island.element);
        root.render(createElement(Component, island.props));
      }
    } catch (error) {
      console.error(`[l5e-island] Failed to mount "${island.registryKey}":`, error);
    }
  };
}

function scheduleMount(island: IslandMeta) {
  const strategy = strategies.get(island.mount);

  if (!strategy) {
    console.error(
      `[l5e-island] Strategy "${island.mount}" not found.`,
      `Available: ${[...strategies.keys()].join(', ')}`,
      `\nDid you forget to registerMountStrategy("${island.mount}", ...)?`,
    );
    return;
  }

  const mountFn = createMountFn(island);
  strategy(mountFn, island.mountOpts, island.element);
}

// ============================================================
// PART 4: Boot
// ============================================================

function boot() {
  const islands = discoverIslands();
  islands.forEach(scheduleMount);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
