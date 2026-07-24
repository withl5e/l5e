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
    /**
     * Optional path prefix prepended to the `/tooltip/:type/:id` fetch, e.g.
     * `/vi` for a localized page. Lets an app serve a distinct, CDN-cacheable
     * tooltip response per locale (or any other URL-scoped variant) without
     * the tooltip system knowing anything about locales itself — the SSR view
     * that renders the trigger just sets this from whatever it already knows
     * (e.g. `getLocale()`).
     */
    tooltipBase?: string;
  };
};

function tooltipUrl(host: TooltipHost): string {
  const { tooltipId: id, tooltipType: type, tooltipBase } = host.dataset;
  return `${tooltipBase ?? ''}/tooltip/${type}/${id}`;
}

export async function showTooltip(host: TooltipHost): Promise<void> {
  /*
   * Trong lúc chờ dynamic import, con trỏ có thể đã rời khỏi phần tử host.
   * Nếu vậy, việc tạo tooltip là không cần thiết và sẽ không có sự kiện
   * `pointerleave` nào được kích hoạt để ẩn tooltip.
   */
  if (!host.matches(':hover')) return;

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
  if (!host.matches(':hover')) {
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
