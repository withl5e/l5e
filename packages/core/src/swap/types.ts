export type SwapMode =
  | 'innerHTML'
  | 'outerHTML'
  | 'beforebegin'
  | 'afterbegin'
  | 'beforeend'
  | 'afterend'
  | 'delete'
  | 'none';

export interface SwapContext {
  triggerElement: HTMLElement | null;
  triggerDataset: DOMStringMap;
}

export interface SwapOptions {
  action?: (ctx: SwapContext) => Promise<Response>;
  select?: string;
  target: string;
  swap?: SwapMode;
  trigger?: string;
  event?: string;
  loading?: {
    target?: string;
    class?: string;
    html?: string;
    disabled?: boolean;
  };
  onBefore?: (ctx: SwapContext) => boolean | void;
  onNodes?: (nodes: Node[], meta: SwapMeta) => Node[] | void;
  onAfter?: (inserted: Node[], meta: SwapMeta, ctx: SwapContext) => void;
  /**
   * @deprecated Use `onAfter` instead. Will be removed in the next release.
   */
  onSwap?: (inserted: Node[], meta: SwapMeta) => void;
  onError?: (err: Error, status?: number) => void;
}

export interface SwapInstance {
  exec(input?: HTMLElement | string): Promise<void>;
  destroy(): void;
}

export interface SwapMeta {
  root: Element | null;
  response?: Response;
}
