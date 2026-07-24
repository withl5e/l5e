// Deliberately receives no props. Proves getLocale() is ambient — any component
// rendered during this request can read the locale without prop-drilling.
import { getLocale } from '~/paraglide/runtime.js';
import { m } from '~/paraglide/messages.js';

export function LocaleBadge() {
  return <p data-testid="locale-badge">{m.nested_badge_label({ locale: getLocale() })}</p>;
}
