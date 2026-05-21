import { parseHTML } from './parse';
import { swap } from './swap';
import type { SwapOptions, SwapInstance, SwapMeta, SwapContext } from './types';

const REQUEST_CLASS = 'l5e-request';

function getNaturalEvent(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (tag === 'form') return 'submit';
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return 'change';
  return 'click';
}

export function createSwap(opts: SwapOptions): SwapInstance {
  let destroyed = false;
  const swapMode = opts.swap ?? 'innerHTML';

  const triggerEls = opts.trigger
    ? Array.from(document.querySelectorAll<HTMLElement>(opts.trigger))
    : [];

  const targetEl = document.querySelector<HTMLElement>(opts.target);

  const firstTrigger = triggerEls[0] ?? null;
  const eventName = opts.event ?? (firstTrigger ? getNaturalEvent(firstTrigger) : 'click');
  const shouldPreventDefault = eventName === 'submit';

  const loadingCfg = opts.loading;
  const loadingClass = loadingCfg?.class ?? REQUEST_CLASS;

  function applyLoading(currentTrigger: HTMLElement | null): () => void {
    if (!loadingCfg) return () => {};
    const el = loadingCfg.target
      ? document.querySelector<HTMLElement>(loadingCfg.target)
      : currentTrigger;
    if (!el) return () => {};

    const shouldDisable = loadingCfg.disabled ?? el === currentTrigger;
    const originalHtml = el.innerHTML;
    const originalDisabled = (el as HTMLButtonElement).disabled ?? false;

    el.classList.add(loadingClass);
    if (loadingCfg.html) el.innerHTML = loadingCfg.html;
    if (shouldDisable && 'disabled' in el) (el as any).disabled = true;

    return () => {
      el.classList.remove(loadingClass);
      if (loadingCfg.html && el !== targetEl) el.innerHTML = originalHtml;
      if (shouldDisable && 'disabled' in el) (el as any).disabled = originalDisabled;
    };
  }

  async function exec(input?: HTMLElement | string): Promise<void> {
    if (destroyed) return;

    if (!targetEl) return;

    const ctxEl = input instanceof HTMLElement ? input : firstTrigger;
    const ctx: SwapContext = {
      triggerElement: ctxEl,
      triggerDataset: ctxEl?.dataset ?? ({} as DOMStringMap),
    };
    const htmlInput = typeof input === 'string' ? input : undefined;

    if (opts.onBefore?.(ctx) === false) return;

    const restoreLoading = applyLoading(ctxEl);

    try {
      let html: string;
      let res: Response | undefined;
      if (opts.action) {
        res = await opts.action(ctx);
        html = await res.text();
      } else if (htmlInput !== undefined) {
        html = htmlInput;
      } else {
        return;
      }

      let nodes: Node[];
      if (opts.select) {
        nodes = parseHTML(html, opts.select) as Node[];
      } else {
        nodes = Array.from(parseHTML(html).childNodes);
      }

      const root = parseHTML(html).firstElementChild as HTMLElement | null;
      const meta: SwapMeta = { root, response: res };

      if (opts.onNodes) {
        const t = opts.onNodes(nodes, meta);
        if (Array.isArray(t)) nodes = t;
      }

      const inserted = swap(targetEl, nodes, swapMode);

      opts.onSwap?.(inserted, meta);
      opts.onAfter?.(inserted, meta, ctx);
    } catch (err: any) {
      opts.onError?.(err, err.status);
    } finally {
      restoreLoading();
    }
  }

  function handleTrigger(e: Event) {
    if (shouldPreventDefault) e.preventDefault();
    exec((e.currentTarget as HTMLElement) ?? undefined);
  }

  triggerEls.forEach((el) => el.addEventListener(eventName, handleTrigger));

  return {
    exec,
    destroy() {
      destroyed = true;
      triggerEls.forEach((el) => el.removeEventListener(eventName, handleTrigger));
    },
  };
}
