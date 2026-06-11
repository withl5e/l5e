import {
  jsxFactory,
  registerIsland,
  registerSsrIsland,
  type JSXChild,
  type JSXNode,
} from '../core/jsx-runtime';

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

  /**
   * Opt-in: server-render the component into the placeholder and hydrate on the
   * client (instead of the default client-only mount). Component must be
   * SSR-safe (no top-level browser access) and props must be JSON-serializable.
   */
  ssr?: boolean;

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
    ssr,
    __key,
    __src,
  } = attrs;

  const componentName = deriveComponentName(from);

  // Register island in render context (like useClientJs)
  // server.ts will use this to generate per-page window.__L5E_ISLANDS__
  // (needed for BOTH client-only mount AND ssr hydration — the client still
  // loads the component chunk via this registry).
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

  // SSR opt-in: register a pending server render and embed a unique token as the
  // placeholder body. entry-server replaces the token with renderToString() output
  // after the synchronous render pass, then normalizes data-island-ssr to "1".
  // The attribute value holds the token so the post-pass can target this exact
  // island (and strip the attribute on render failure → clean client-only fallback).
  if (ssr && __src) {
    const token = registerSsrIsland(__src, componentName, props);
    if (token) {
      return jsxFactory('div', {
        ...dataAttrs,
        'data-island-ssr': token,
        ...(id ? { id } : {}),
        class: className ? `l5e-island ${className}` : 'l5e-island',
        // Raw token comment as body; replaced with SSR HTML in entry-server.
        setHtml: `<!--${token}-->`,
      });
    }
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
