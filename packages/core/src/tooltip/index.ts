export { initTooltips, setupTooltipObserver } from './tooltip-loader';
export { configureTooltip } from './tooltip-config';
export type { TooltipUrlContext, TooltipUrlStrategy } from './tooltip-config';
import type { TooltipHost } from './tooltip-config';

// Keep the public API lazy too: a static re-export makes the library build
// inline the runtime into this entry and erases the loader's import boundary.
export async function showTooltip(host: TooltipHost): Promise<void> {
  const runtime = await import('./tooltip-runtime');
  return runtime.showTooltip(host);
}

export async function showTooltipMobile(host: TooltipHost): Promise<void> {
  const runtime = await import('./tooltip-runtime');
  return runtime.showTooltipMobile(host);
}
