import { RAW_HTML_MARKER } from './const';
import {
  addCacheTag,
  type HtmlContentObject,
  type JSXChild,
  type JSXNode,
  type RenderedNode,
} from './jsx-runtime';

if (true) {
  console.log('render.ts');
}

const VOID_ELEMENTS = new Set<string>([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

function classList(input: unknown): string {
  if (!input) return '';
  if (typeof input === 'string') return input;
  if (Array.isArray(input)) {
    return input.map(classList).filter(Boolean).join(' ');
  }
  if (typeof input === 'object') {
    return Object.keys(input as Record<string, boolean>)
      .filter((key) => (input as Record<string, boolean>)[key])
      .join(' ');
  }
  return '';
}

export function escapeProp(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\n', '&#10;')
    .trim();
}

export function escapeHTML(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\n', '<br/>');
}

function renderAttributes(props?: Record<string, any>): string {
  if (!props) return '';

  let classValue = '';
  if (props.classList !== undefined) {
    classValue = classList(props.classList);
  }
  if (props.class) {
    const existingClass = typeof props.class === 'string' ? props.class : '';
    classValue = classValue ? `${classValue} ${existingClass}`.trim() : existingClass;
  }

  const attrs = Object.entries(props)
    .filter(
      ([key]) =>
        key !== 'children' &&
        key !== 'classList' &&
        key !== 'setHtml' &&
        key !== 'setText' &&
        key !== 'class' &&
        key !== 'key' &&
        key !== 'cacheTag',
    )
    .map(([key, value]) => {
      // HTML standard behavior with function execution support
      if (value === false || value === null || value === undefined) return '';
      if (value === true) return key;

      // Execute function props and get result (new feature)
      if (typeof value === 'function') {
        const result = value();
        return `${key}="${escapeProp(result?.toString() || '')}"`;
      }

      return `${key}="${escapeProp(value?.toString() || '')}"`;
    })
    .filter(Boolean) as string[];

  if (classValue) {
    attrs.push(`class="${escapeProp(classValue)}"`);
  }

  return attrs.join(' ');
}

function renderJsxToHtmlStringInternal(element: JSXChild): string {
  // HTML standard: skip boolean, null, undefined children
  if (element === null || typeof element === 'boolean' || element === undefined) return '';

  if (element && typeof element === 'object' && (element as any)[RAW_HTML_MARKER]) {
    return (element as any).content || '';
  }

  // Support htmlContent object (new feature)
  if (element && typeof element === 'object' && 'htmlContent' in element) {
    return (element as HtmlContentObject).htmlContent;
  }

  if (typeof element === 'string') return escapeHTML(element.toString());
  if (typeof element === 'number') return element.toString();

  if (Array.isArray(element)) {
    return (element as JSXChild[]).map((el) => renderJsxToHtmlStringInternal(el)).join('');
  }

  const { type, props, children } = element as JSXNode;

  // Collect cache tags from props
  if (props?.cacheTag) {
    addCacheTag(props.cacheTag);
  }

  if (typeof type === 'function') {
    const componentResult = (type as any)({ ...(props || {}), children });
    // Check if component returned a RenderedNode
    if (componentResult && typeof componentResult === 'object' && 'string' in componentResult) {
      return (componentResult as RenderedNode).string;
    }
    return renderJsxToHtmlStringInternal(componentResult as JSXChild);
  }

  const attrs = renderAttributes(props);
  const isVoidElement = VOID_ELEMENTS.has((type as string).toLowerCase());

  if (isVoidElement) {
    return `<${type}${attrs ? ' ' + attrs : ''} />`;
  }

  let childrenHtml = '';
  if (props?.setHtml !== undefined) {
    childrenHtml = props.setHtml?.toString() || '';
  } else if (props?.setText !== undefined) {
    childrenHtml = escapeHTML(props.setText?.toString() || '');
  } else {
    childrenHtml = (children as JSXChild[]).map((el) => renderJsxToHtmlStringInternal(el)).join('');
  }

  return `<${type}${attrs ? ' ' + attrs : ''}>${childrenHtml}</${type}>`;
}

export function renderJsxToHtmlString(element: JSXChild | RenderedNode): string {
  // If already a RenderedNode, return its string
  if (element && typeof element === 'object' && 'string' in element) {
    return (element as RenderedNode).string;
  }
  return renderJsxToHtmlStringInternal(element as JSXChild);
}

export function renderToRenderedNode(element: JSXChild | RenderedNode): RenderedNode {
  // If already a RenderedNode, return as is
  if (element && typeof element === 'object' && 'string' in element) {
    return element as RenderedNode;
  }
  return {
    string: renderJsxToHtmlStringInternal(element as JSXChild),
  };
}
