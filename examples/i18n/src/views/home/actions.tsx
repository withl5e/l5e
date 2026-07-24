import { defineAction } from '@withl5e/l5e/action';
import { getLocale } from '~/paraglide/runtime.js';
import { m } from '~/paraglide/messages.js';

// Action requests hit /_l5e/action/:actionKey — never a locale-prefixed URL.
// Locale here comes from the DEMO_LOCALE cookie, which is why src/middleware.ts
// checks 'cookie' before 'url': actions (and the tooltip route) have no URL
// prefix to resolve from, so cookie is the only signal that survives the trip.
export const loadGreeting = defineAction({
  method: 'GET',
  handler: () => {
    return (
      <span data-swap-target="action-result" data-testid="action-result">
        {m.action_result_label({ locale: getLocale() })}
      </span>
    );
  },
});
