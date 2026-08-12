// tooltip-runtime.ts
// Logic đầy đủ cho tooltip, chỉ được tải khi cần thiết

import type { Middleware, Placement } from '@floating-ui/dom';
import { autoUpdate, computePosition, flip, hide, offset, shift } from '@floating-ui/dom';

type TooltipHost = HTMLElement & {
  dataset: {
    tooltipId: string;
    tooltipType?: string;
    tooltipPlacement?: Placement;
    href?: string;
  };
};

/** Everything the tooltip system knows about one request, for a custom strategy to build a URL from. */
export interface TooltipUrlContext {
  type: string;
  id: string;
  host: TooltipHost;
}

export type TooltipUrlStrategy = (ctx: TooltipUrlContext) => string;

const defaultStrategy: TooltipUrlStrategy = ({ type, id }) => `/tooltip/${type}/${id}`;

/**
 * If the page's own URL already carries a prefix matching `<html lang>` (e.g.
 * `<html lang="vi">` on `/vi/...`), reuse that same prefix — for apps doing
 * URL-prefix locale routing that want each locale to be a distinct,
 * CDN-cacheable tooltip URL with zero per-page setup. A base-locale page
 * (unprefixed URL) naturally infers no prefix.
 */
const autoLocaleStrategy: TooltipUrlStrategy = ({ type, id }) => {
  const lang = document.documentElement.lang;
  let prefix = '';
  if (lang) {
    const primary = lang.split('-')[0].toLowerCase();
    const match = location.pathname.match(/^\/([a-zA-Z-]+)(?:\/|$)/);
    const segment = match?.[1];
    if (segment && (segment.toLowerCase() === primary || segment.toLowerCase() === lang.toLowerCase())) {
      prefix = `/${segment}`;
    }
  }
  return `${prefix}/tooltip/${type}/${id}`;
};

declare global {
  interface Window {
    // L5E's per-request bundler compiles each view's client script (and
    // client.global.ts) as independent bundles — a view that imports
    // initTooltips()/showTooltip() gets its own inlined copy of this whole
    // module, with its own module-scoped variables. A plain `let` here
    // would only ever be seen by whichever single bundle happens to define
    // it, not by the others — so this has to live on `window`, the one
    // thing every independently-bundled script actually shares.
    __l5eTooltipUrl?: TooltipUrlStrategy;
  }
}

/**
 * Replace how every tooltip's fetch URL is built. L5E is not an i18n
 * framework and most apps using tooltips don't localize URLs (or need any
 * custom scheme) at all, so the default is `/tooltip/:type/:id` unless an
 * app opts into something else — call this once at startup, e.g. in
 * `client.global.ts` so it runs regardless of which view's own client
 * script actually mounts a tooltip:
 *
 * ```ts
 * configureTooltip('auto-locale'); // infer /vi (or none) from <html lang> + URL
 * // or fully custom:
 * configureTooltip(({ type, id }) => `/api/v2/tooltips/${type}-${id}`);
 * ```
 */
export function configureTooltip(strategy: 'auto-locale' | TooltipUrlStrategy): void {
  window.__l5eTooltipUrl = strategy === 'auto-locale' ? autoLocaleStrategy : strategy;
}

function tooltipUrl(host: TooltipHost): string {
  const { tooltipId: id, tooltipType: type } = host.dataset;
  const strategy = window.__l5eTooltipUrl ?? defaultStrategy;
  return strategy({ type: type ?? '', id: id ?? '', host });
}

export async function showTooltip(host: TooltipHost): Promise<void> {
  /*
   * Trong lúc chờ dynamic import, con trỏ có thể đã rời khỏi phần tử host.
   * Nếu vậy, việc tạo tooltip là không cần thiết và sẽ không có sự kiện
   * `pointerleave` nào được kích hoạt để ẩn tooltip.
   */
  if (!host.hasAttribute('data-tooltip-active')) return;

  const tip = document.createElement('div');
  tip.className = 'tp';
  tip.innerHTML = '<div class="tp-loading">Loading...</div>';
  document.body.append(tip);

  // --- Cleanup ---
  let cleanupAutoUpdate: (() => void) | null = null;

  const cleanup = () => {
    if (cleanupAutoUpdate) {
      cleanupAutoUpdate();
      cleanupAutoUpdate = null;
    }
    if (document.body.contains(tip)) tip.remove();
  };

  host.addEventListener('pointerleave', cleanup);

  // Con trỏ đã rời trước khi listener được gắn
  if (!host.hasAttribute('data-tooltip-active')) {
    host.removeEventListener('pointerleave', cleanup);
    tip.remove();
    return;
  }

  // --- Position: autoUpdate thay thế manual scroll/resize ---
  cleanupAutoUpdate = autoUpdate(host, tip, () => position(host, tip));

  // --- Fetch nội dung từ server ---
  try {
    const html = await fetch(tooltipUrl(host), {
      headers: { Accept: 'text/html' },
    }).then((r) => r.text());

    if (!document.body.contains(tip)) return;

    tip.innerHTML = html;
    await position(host, tip);
  } catch {
    if (document.body.contains(tip)) {
      tip.innerHTML = '<div class="tp-error">Không thể tải tooltip</div>';
    }
  }
}

/**
 * Mobile: hiển thị tooltip dạng fullscreen popup.
 * Nếu host có data-href, thêm nút "Xem chi tiết" dẫn đến link đó.
 */
export async function showTooltipMobile(host: TooltipHost): Promise<void> {
  const overlay = document.createElement('div');
  overlay.className = 'tp-overlay';

  const popup = document.createElement('div');
  popup.className = 'tp-mobile';
  popup.innerHTML = '<div class="tp-loading">Loading...</div>';

  overlay.append(popup);
  document.body.append(overlay);
  document.body.style.overflow = 'hidden';

  const cleanup = () => {
    overlay.remove();
    document.body.style.overflow = '';
  };

  // Đóng khi bấm vào overlay (bên ngoài popup)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cleanup();
  });

  try {
    const html = await fetch(tooltipUrl(host), {
      headers: { Accept: 'text/html' },
    }).then((r) => r.text());

    popup.innerHTML = '';

    // Nút đóng
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tp-mobile-close';
    closeBtn.innerHTML = '&#x2715;';
    closeBtn.addEventListener('click', cleanup);
    popup.append(closeBtn);

    // Nội dung
    const content = document.createElement('div');
    content.className = 'tp-mobile-content';
    content.innerHTML = html;
    popup.append(content);

    // Nút "Xem chi tiết" nếu có data-href
    const href = host.dataset.href;
    if (href) {
      const link = document.createElement('a');
      link.className = 'tp-mobile-link';
      link.href = href;
      link.textContent = 'Xem chi tiết';
      popup.append(link);
    }
  } catch {
    popup.innerHTML = '<div class="tp-error">Không thể tải tooltip</div>';
  }
}

/**
 * Khi tooltip cao hơn 60% viewport, bỏ qua placement trên/dưới host
 * và căn giữa theo chiều dọc màn hình + giới hạn maxHeight để scroll.
 */
function centerFallback(): Middleware {
  return {
    name: 'centerFallback',
    fn({ rects }) {
      const vh = window.innerHeight;
      const padding = 8;

      if (rects.floating.height <= vh * 0.6) return {};

      return {
        y: window.scrollY + Math.max(padding, (vh - rects.floating.height) / 2),
        data: { centered: true, maxHeight: vh - padding * 2 },
      };
    },
  };
}

function position(host: TooltipHost, tip: HTMLDivElement): Promise<void> {
  const preferredPlacement = host.dataset.tooltipPlacement;
  const placement = preferredPlacement ?? 'left';

  return computePosition(host, tip, {
    placement,
    middleware: [offset(6), flip(), shift({ padding: 5 }), centerFallback(), hide()],
  }).then(({ x, y, middlewareData }) => {
    Object.assign(tip.style, { left: `${x}px`, top: `${y}px` });

    tip.style.visibility = middlewareData.hide?.referenceHidden ? 'hidden' : 'visible';

    const center = middlewareData.centerFallback as { centered?: boolean; maxHeight?: number };
    if (center?.centered) {
      tip.style.maxHeight = `${center.maxHeight}px`;
      tip.style.overflowY = 'auto';
    } else {
      tip.style.maxHeight = '';
      tip.style.overflowY = '';
    }
  });
}
