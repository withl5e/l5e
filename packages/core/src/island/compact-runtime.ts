import type { IslandMeta } from './types';
import { strategies, registerMountStrategy } from './strategy-registry';

registerMountStrategy('load', (mount) => void mount());
registerMountStrategy('idle', (mount) => {
  if ('requestIdleCallback' in window) requestIdleCallback(() => mount());
  else setTimeout(() => mount(), 200);
});
registerMountStrategy('visible', (mount, opts, el) => {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        mount();
      }
    },
    { rootMargin: opts || '200px' },
  );
  observer.observe(el);
  return () => observer.disconnect();
});
registerMountStrategy('media', (mount, opts) => {
  if (!opts) {
    console.error('[l5e-island] Strategy "media" requires mountOpts (media query)');
    return;
  }
  const query = window.matchMedia(opts);
  if (query.matches) mount();
  else {
    const handler = (event: MediaQueryListEvent) => event.matches && mount();
    query.addEventListener('change', handler, { once: true });
    return () => query.removeEventListener('change', handler);
  }
});
registerMountStrategy('none', () => {});

import 'virtual:l5e-island-strategies';

type CompactIslandModule = {
  reactDomClient: typeof import('react-dom/client');
  createElement: typeof import('react').createElement;
  module: Record<string, any>;
};
const registry: Record<string, () => Promise<CompactIslandModule>> = ((window as any)
  .__L5E_ISLANDS__ ||= {});
let islandData: unknown[] | null = null;
const scheduled = new WeakSet<Element>();

function props(element: Element): Record<string, unknown> {
  const index = element.getAttribute('data-island-idx');
  if (index === null) return JSON.parse(element.getAttribute('data-island-props') || '{}');
  if (!islandData) {
    const store = document.getElementById('_l5e_data_');
    try {
      const parsed = JSON.parse(store?.textContent || '[]');
      islandData = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('[l5e-island] Failed to parse _l5e_data_ props store:', error);
      islandData = [];
    }
  }
  return (islandData[Number(index)] as Record<string, unknown>) || {};
}

function discover(): IslandMeta[] {
  return Array.from(document.querySelectorAll('[data-island]')).map((element) => ({
    element: element as HTMLElement,
    registryKey: element.getAttribute('data-island')!,
    exportName: element.getAttribute('data-island-name')!,
    props: props(element),
    mount: element.getAttribute('data-island-mount') || 'load',
    mountOpts: element.getAttribute('data-island-opts') || undefined,
    ssr: element.hasAttribute('data-island-ssr'),
  }));
}

function mount(island: IslandMeta) {
  let mounted = false;
  return async () => {
    if (mounted) return;
    mounted = true;
    const loader = registry[island.registryKey];
    if (!loader) {
      console.error(`[l5e-island] Component "${island.registryKey}" not found in page registry.`);
      return;
    }
    try {
      const { reactDomClient, createElement, module } = await loader();
      const Component = module.default || module[island.exportName];
      if (!Component) throw new Error(`No export "default" or "${island.exportName}" in module`);
      if (island.ssr) {
        reactDomClient.hydrateRoot(island.element, createElement(Component, island.props));
      } else {
        const root = reactDomClient.createRoot(island.element);
        root.render(createElement(Component, island.props));
      }
    } catch (error) {
      console.error(`[l5e-island] Failed to mount "${island.registryKey}":`, error);
    }
  };
}

function boot() {
  for (const island of discover()) {
    if (scheduled.has(island.element)) continue;
    // The compact global can execute before the page bundle registers its loaders.
    // The page bundle calls boot again after registration.
    if (!registry[island.registryKey]) continue;
    const strategy = strategies.get(island.mount);
    if (!strategy) {
      console.error(`[l5e-island] Strategy "${island.mount}" not found.`);
      continue;
    }
    scheduled.add(island.element);
    strategy(mount(island), island.mountOpts, island.element);
  }
}

(globalThis as any).__L5E_BOOT_ISLANDS__ = boot;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
