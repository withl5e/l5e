import { createSwap } from '@l5e/core/swap';
import { loadServerTime } from './actions';

createSwap({
  trigger: '[data-load-time]',
  target: '[data-swap-target="server-time"]',
  select: '[data-swap-target="server-time"]',
  swap: 'outerHTML',
  action: () => loadServerTime({}),
});
