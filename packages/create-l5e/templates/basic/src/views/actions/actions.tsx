import { defineAction } from '@withl5e/l5e/action';

export const loadServerTime = defineAction({
  method: 'GET',
  handler: () => {
    return <span data-swap-target="server-time">{new Date().toISOString()}</span>;
  },
});
