// tooltip-loader.ts
// File này chỉ làm nhiệm vụ wake up tooltip khi cần thiết

// Định nghĩa kiểu cho tooltip host element
type TooltipHost = HTMLElement & {
  dataset: {
    tooltipId: string;
    tooltipType?: string;
  };
};

/**
 * Kiểm tra xem thiết bị hiện tại có phải là thiết bị di động hay không
 * @returns true nếu là thiết bị di động
 */
function isMobileDevice(): boolean {
  // Kiểm tra User Agent
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile =
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(userAgent);

  // Kiểm tra thêm kích thước màn hình (dưới 768px thường được coi là thiết bị di động)
  const isTouchScreen = window.matchMedia('(max-width: 768px)').matches;

  return isMobile || isTouchScreen;
}

/**
 * Hàm khởi tạo tooltip, chỉ load runtime khi cần thiết
 */
export function initTooltips(): void {
  const tooltipTriggers = document.querySelectorAll<TooltipHost>('[data-tooltip-id]');
  if (tooltipTriggers.length === 0) return;

  const mobile = isMobileDevice();

  tooltipTriggers.forEach((trigger) => {
    if (trigger.hasAttribute('data-tooltip-initialized')) return;
    trigger.setAttribute('data-tooltip-initialized', 'true');

    if (mobile) {
      trigger.addEventListener('click', async (e) => {
        e.preventDefault();
        const { showTooltipMobile } = await import('./tooltip-runtime');
        showTooltipMobile(trigger);
      });
    } else {
      trigger.addEventListener(
        'pointerenter',
        async () => {
          const { showTooltip } = await import('./tooltip-runtime');
          showTooltip(trigger);
        },
        { passive: true },
      );
    }
  });
}

// Thêm một MutationObserver để theo dõi các phần tử DOM mới (cho React components)
export function setupTooltipObserver(): void {
  // Kiểm tra xem đã có observer chưa
  if (window.__tooltipObserver) return;

  // Observer theo dõi khi có phần tử mới được thêm vào DOM
  const observer = new MutationObserver((mutations) => {
    let shouldInit = false;

    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Kiểm tra xem có phần tử tooltip nào mới được thêm vào không
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            // Kiểm tra nếu phần tử có data-tooltip-id hoặc chứa phần tử con có data-tooltip-id
            if (
              element.hasAttribute('data-tooltip-id') ||
              element.querySelector('[data-tooltip-id]')
            ) {
              shouldInit = true;
            }
          }
        });
      }
    });

    // Chỉ gọi initTooltips nếu có phát hiện tooltip mới
    if (shouldInit) {
      initTooltips();
    }
  });

  // Bắt đầu theo dõi toàn bộ DOM
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Lưu observer vào window để tránh tạo nhiều observer
  window.__tooltipObserver = observer;
}

// Typescript declaration cho window object
declare global {
  interface Window {
    __tooltipObserver?: MutationObserver;
  }
}
