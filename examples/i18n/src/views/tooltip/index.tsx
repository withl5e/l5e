import { getLocale } from '~/paraglide/runtime.js';
import { m } from '~/paraglide/messages.js';

import type { TooltipLoaderData } from './loader';

// Fetched by @withl5e/l5e/tooltip's client runtime via `fetch('/tooltip/:type/:id')`.
// This request never carries a locale-prefixed URL of its own — the locale
// comes from the DEMO_LOCALE cookie (see src/middleware.ts's strategy order),
// proving locale detection works for non-page fetches too, not just documents.
export default function TooltipFragment({ type, id }: TooltipLoaderData) {
  return (
    <div class="tp-content" data-testid="tooltip-content">
      <p>{m.tooltip_content_label({ locale: getLocale() })}</p>
      <p>
        type={type}, id={id}
      </p>
    </div>
  );
}
