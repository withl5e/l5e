/**
 * Mount strategy function signature
 *
 * @param mount  - Call when you want to load JS + mount React component
 * @param opts   - Value from mountOpts prop (string | undefined)
 * @param el     - DOM element containing the island
 * @returns      - Optional cleanup function (called when island is removed)
 */
export type MountStrategy = (
  mount: () => Promise<void>,
  opts: string | undefined,
  el: HTMLElement,
) => void | (() => void);

export interface IslandMeta {
  element: HTMLElement;
  registryKey: string; // "Counter_a3f2" - to find loader in registry
  exportName: string; // "Counter" - to find export in module
  props: Record<string, any>;
  mount: string; // Strategy name
  mountOpts?: string; // Options passed to strategy function
  ssr?: boolean; // Server-rendered → hydrate instead of fresh client mount
}

export interface IslandEntry {
  component: string; // "Counter" (derived from resolvedPath filename)
  resolvedPath: string; // "/src/views/test-island/react/Counter"
  key: string; // "Counter_a3f2"
}
