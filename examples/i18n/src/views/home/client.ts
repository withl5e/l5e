import { createSwap } from '@withl5e/l5e/swap';
import { initTooltips, setupTooltipObserver } from '@withl5e/l5e/tooltip';
import { getLocale } from '~/paraglide/runtime.js';
import { loadGreeting } from './actions';

// First client-side getLocale() call syncs the DEMO_LOCALE cookie to whatever
// locale this page actually rendered in (Paraglide does this automatically —
// see get-locale.js's `setLocale(resolved, { reload: false })` on first read).
// Without this, a fresh visitor who never triggered a client-side getLocale()
// read wouldn't have a cookie yet, and actions/tooltip fetches (which have no
// locale-prefixed URL of their own) would fall back to the base locale.
getLocale();

createSwap({
  trigger: '[data-load-greeting]',
  target: '[data-swap-target="action-result"]',
  select: '[data-swap-target="action-result"]',
  swap: 'outerHTML',
  action: () => loadGreeting({}),
});

initTooltips();
setupTooltipObserver();
