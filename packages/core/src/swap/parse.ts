export function parseHTML(html: string): DocumentFragment;
export function parseHTML(html: string, selector: string): Element[];
export function parseHTML(html: string, selector?: string): DocumentFragment | Element[] {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const fragment = tpl.content;

  if (selector) {
    return Array.from(fragment.querySelectorAll(selector));
  }
  return fragment;
}
