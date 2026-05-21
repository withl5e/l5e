import type { SwapMode } from './types';

export function swap(target: Element, nodes: Node[], mode: SwapMode): Node[] {
  switch (mode) {
    case 'innerHTML':
      target.innerHTML = '';
      const innerInserted: Node[] = [];
      for (const n of nodes) {
        const added = target.appendChild(n);
        innerInserted.push(added);
      }
      return innerInserted;

    case 'outerHTML': {
      const parent = target.parentNode;
      if (!parent) return [];
      const outerInserted: Node[] = [];
      for (const n of nodes) {
        parent.insertBefore(n, target);
        outerInserted.push(n);
      }
      parent.removeChild(target);
      return outerInserted;
    }

    case 'beforebegin': {
      const parent = target.parentNode;
      if (!parent) return [];
      return nodes.map((n) => parent.insertBefore(n, target));
    }

    case 'afterbegin': {
      const first = target.firstChild;
      return nodes.map((n) => target.insertBefore(n, first));
    }

    case 'beforeend':
      return nodes.map((n) => target.appendChild(n));

    case 'afterend': {
      const parent = target.parentNode;
      if (!parent) return [];
      const ref = target.nextSibling;
      return nodes.map((n) => parent.insertBefore(n, ref));
    }

    case 'delete':
      target.remove();
      return [];

    case 'none':
      return [];

    default:
      return [];
  }
}
