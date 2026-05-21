import { jsxFactory, registerIsland, type JSXChild, type JSXNode } from '../core/jsx-runtime';

/**
 * Derive component name from `from` path.
 * "./react/Counter" → "Counter"
 * "~/features/newsfeed/react/NewsfeedApp" → "NewsfeedApp"
 */
function deriveComponentName(from: string): string {
  const segments = from.split('/');
  let filename = segments[segments.length - 1];
  filename = filename.replace(/\.(tsx?|jsx?)$/, '');
  return filename;
}
export type MountStrategy = 'load' | 'idle' | 'visible' | 'media' | 'none';
export interface ClientIslandProps {
  from: string;
  props?: Record<string, any>;
  mount?: MountStrategy | string;
  mountOpts?: string;
  class?: string;
  id?: string;
  children?: JSXChild | JSXChild[];

  /** INTERNAL — injected by vite-plugin. Format: "[name]_[hash]" */
  __key?: string;
  /** INTERNAL — injected by vite-plugin. Manifest-compatible source path with extension */
  __src?: string;
}

export function ClientIsland(attrs: ClientIslandProps): JSXNode {
  const {
    from,
    props = {},
    mount = 'load',
    mountOpts,
    class: className,
    id,
    children,
    __key,
    __src,
  } = attrs;

  const componentName = deriveComponentName(from);

  // Register island in render context (like useClientJs)
  // server.ts will use this to generate per-page window.__L5E_ISLANDS__
  if (__key && __src) {
    registerIsland(__key, __src, componentName);
  }

  const dataAttrs: Record<string, string> = {
    'data-island': __key || 'unresolved',
    'data-island-name': componentName,
    'data-island-props': JSON.stringify(props),
    'data-island-mount': mount,
  };

  if (mountOpts) {
    dataAttrs['data-island-opts'] = mountOpts;
  }

  return jsxFactory(
    'div',
    {
      ...dataAttrs,
      ...(id ? { id } : {}),
      class: className ? `l5e-island ${className}` : 'l5e-island',
    },
    children,
  );
}
