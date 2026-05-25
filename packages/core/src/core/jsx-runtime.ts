import { mergeMetadata } from '../seo/mergeMetadata';
import type { Metadata } from '../seo/types';
import { RAW_HTML_MARKER } from './const';
import { RequestInfo } from './entry-server';
import { HEAD_PRIORITY, type HeadPriority } from './head-priority';

export type JSXChild =
  | string
  | number
  | boolean
  | null
  | undefined
  | JSXNode
  | JSXChild[]
  | RawHtmlObject
  | HtmlContentObject;

export type RawHtmlObject = {
  [RAW_HTML_MARKER]: true;
  content: string;
};

export type HtmlContentObject = {
  htmlContent: string;
};

export type RenderedNode = {
  string: string;
};

export type JSXNode = {
  type: string | ((props: any) => JSXChild);
  props: Record<string, any>;
  children: JSXChild[];
};

export function jsxFactory(type: any, props: any, ...children: any): JSXNode {
  return { type, props: props || {}, children: children.flat() };
}

export function Fragment({
  children,
  ...props
}: { children?: JSXChild; setHtml?: unknown } & Record<string, any>): JSXChild {
  // Hỗ trợ setHtml cho Fragment
  if (props.setHtml !== undefined) {
    // Trả về object đặc biệt để không bị escape
    return { [RAW_HTML_MARKER]: true, content: props.setHtml?.toString() || '' };
  }
  return children;
}

// AsyncLocalStorage for render context (request-level)
import { AsyncLocalStorage } from 'async_hooks';

interface HeadEntry {
  content: JSXChild;
  priority: number; // Số càng nhỏ, render càng sớm
  source?: string; // Để debug (ví dụ: 'layout', 'page', 'seo')
}

interface IslandEntry {
  key: string; // "Counter_a3f2" — registry key
  src: string; // "src/views/.../Counter.tsx" — manifest-compatible path
  name: string; // "Counter" — export name
}

interface RenderContext {
  clientJsRegistry: Array<{ path: string; from: string }>;
  cssRegistry: Array<{ path: string; from: string }>;
  islandRegistry: IslandEntry[];
  cacheTags: Set<string>;
  headRegistry: HeadEntry[]; // Thay vì JSXChild[]
  metadataStack: Metadata[]; // Stack để track metadata hierarchy
  schemaRegistry: Array<Record<string, any>>; // Schema.org structured data từ loaders
  request: RequestInfo;
  viewName?: string; // View name from route handler
}

const renderStore = new AsyncLocalStorage<RenderContext>();

// Create context for each request
function createRequestContext(requestInfo: RequestInfo): RenderContext {
  return {
    clientJsRegistry: [],
    cssRegistry: [],
    islandRegistry: [],
    cacheTags: new Set(),
    headRegistry: [],
    metadataStack: [],
    schemaRegistry: [],
    request: requestInfo,
  };
}

export function useClientJs(path: string): string {
  if (typeof path === 'string' && path.length > 0) {
    const renderContext = renderStore.getStore();
    if (renderContext) {
      renderContext.clientJsRegistry.push({ path, from: 'Unknown' });
    }
  }
  return '';
}

export function registerIsland(key: string, src: string, name: string): void {
  const renderContext = renderStore.getStore();
  if (renderContext) {
    // Dedupe by key
    if (!renderContext.islandRegistry.some((e) => e.key === key)) {
      renderContext.islandRegistry.push({ key, src, name });
    }
  }
}

export function getIslandEntries(): IslandEntry[] {
  const context = renderStore.getStore();
  if (!context) return [];
  return context.islandRegistry.slice();
}

export function useCss(path: string): string {
  if (typeof path === 'string' && path.length > 0) {
    const renderContext = renderStore.getStore();
    if (renderContext) {
      renderContext.cssRegistry.push({ path, from: 'Unknown' });
    }
  }
  return '';
}

// Wrapper to run render in async context
export function runInRenderContext<T>(
  renderFn: () => T | Promise<T>,
  requestInfo: RequestInfo,
  viewName?: string,
): Promise<T> {
  const context = createRequestContext(requestInfo);
  if (viewName) {
    context.viewName = viewName;
  }
  return renderStore.run(context, () => Promise.resolve(renderFn()));
}

// Set view name in current render context
export function setViewName(viewName: string): void {
  const context = renderStore.getStore();
  if (context) {
    context.viewName = viewName;
  }
}

// Get entries from current context
export function getClientJsEntries(): Array<{ path: string; from: string }> {
  const context = renderStore.getStore();
  if (!context) return [];
  return context.clientJsRegistry.slice();
}

// Get cache tags from current context
export function getCacheTags(): string[] {
  const context = renderStore.getStore();
  if (!context) return [];
  return Array.from(context.cacheTags);
}

// Add cache tags to current context
export function addCacheTag(tag: string | string[] | Record<string, boolean>): void {
  const context = renderStore.getStore();
  if (!context) return;

  if (Array.isArray(tag)) {
    tag.forEach((t) => {
      if (typeof t === 'string' && t.trim()) {
        context.cacheTags.add(t.trim());
      }
    });
  } else if (typeof tag === 'string' && tag.trim()) {
    context.cacheTags.add(tag.trim());
  } else if (typeof tag === 'object' && tag !== null) {
    Object.entries(tag).forEach(([key, value]) => {
      if (value && typeof key === 'string' && key.trim()) {
        context.cacheTags.add(key.trim());
      }
    });
  }
}

// Get CSS entries from current context
export function getCssEntries(): Array<{ path: string; from: string }> {
  const context = renderStore.getStore();
  if (!context) return [];
  return context.cssRegistry.slice();
}

// Head component to collect head elements with priority support
export function Head({
  children,
  priority = HEAD_PRIORITY.LOW, // Default priority
}: {
  children?: JSXChild;
  priority?: HeadPriority;
}): null {
  const renderContext = renderStore.getStore();
  if (renderContext && children) {
    renderContext.headRegistry.push({
      content: children,
      priority: typeof priority === 'number' ? priority : HEAD_PRIORITY.LOW,
      source: 'manual',
    });

    // Sort theo priority sau mỗi lần push để đảm bảo thứ tự đúng
    renderContext.headRegistry.sort((a, b) => a.priority - b.priority);
  }
  return null;
}

// Get head content from current context (already sorted by priority)
export function getHeadContent(): JSXChild[] {
  const context = renderStore.getStore();
  if (!context) return [];
  // Đã được sort trong Head component, chỉ cần map để lấy content
  return context.headRegistry.map((entry) => entry.content);
}

// Push metadata to stack (for hierarchical metadata support)
export function pushMetadata(metadata: Metadata): void {
  const context = renderStore.getStore();
  if (context && metadata) {
    context.metadataStack.push(metadata);
  }
}

// Resolve and merge all metadata from stack (root → leaf)
export function resolveMetadata(): Metadata | null {
  const context = renderStore.getStore();
  if (!context || context.metadataStack.length === 0) {
    return null;
  }

  // Merge from root → leaf (reduce left to right)
  return context.metadataStack.reduce(
    (acc, current) => mergeMetadata(acc, current),
    null as Metadata | null,
  );
}

// Push schema to registry (for schema markup from loaders)
// Accepts schema-dts types (WithContext<T> or array of schemas)
export function pushSchema(schema: any | Array<any>): void {
  const context = renderStore.getStore();
  if (!context) return;

  if (Array.isArray(schema)) {
    context.schemaRegistry.push(...schema);
  } else {
    context.schemaRegistry.push(schema);
  }
}

// Get all schemas from registry
export function getSchemas(): Array<Record<string, any>> {
  const context = renderStore.getStore();
  if (!context) return [];
  return context.schemaRegistry.slice();
}

// Hook to get render request context
export function useRequest() {
  const context = renderStore.getStore();

  if (!context) {
    throw new Error('useRequest called outside of render context');
  }

  return {
    request: context.request,
    view: context.viewName,
    locals: (context.request.locals ?? {}) as Record<string, unknown>,
    params: (context.request.params ?? {}) as Record<string, any>,

    // Add cache tags
    addCacheTag: (tag: string | string[] | Record<string, boolean>) => {
      addCacheTag(tag);
    },

    // Get all cache tags
    getCacheTags: () => {
      return Array.from(context.cacheTags);
    },
  };
}

/**
 * Checks if a value is a valid JSX element (JSXNode)
 * Similar to React.isValidElement
 */
export function isValidElement(value: any): value is JSXNode {
  return (
    value !== null &&
    typeof value === 'object' &&
    'type' in value &&
    'props' in value &&
    'children' in value &&
    (typeof value.type === 'string' || typeof value.type === 'function')
  );
}

/**
 * Clones a JSX element with new props and/or children
 * Similar to React.cloneElement
 */
export function cloneElement(
  element: JSXNode,
  props?: Record<string, any>,
  ...children: JSXChild[]
): JSXNode {
  const newProps = { ...element.props, ...props };
  const newChildren = children.length > 0 ? children.flat() : element.children;

  return {
    type: element.type,
    props: newProps,
    children: newChildren,
  };
}
