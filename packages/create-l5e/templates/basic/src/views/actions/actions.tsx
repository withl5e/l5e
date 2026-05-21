import { defineAction } from '@l5e/core/action';

export const loadServerTime = defineAction({
  method: 'GET',
  handler: () => {
    return <span data-swap-target="server-time">{new Date().toISOString()}</span>;
  },
});
