/** @jsxImportSource react */
import { useState } from 'react';
import { m } from '~/paraglide/messages.js';
import { getLocale } from '~/paraglide/runtime.js';

export interface LocaleCounterProps {
  initCount?: number;
  testId: string;
}

// No `locale` prop needed — Paraglide's client-side getLocale() reads from
// window.location (the 'url' strategy) rather than AsyncLocalStorage, and
// the browser only ever has one "current page" to resolve for, unlike the
// server juggling many concurrent requests. So the ambient call resolves to
// the exact same locale the server rendered with, with no prop-drilling
// needed even across this server/client (React island) boundary.
export function LocaleCounter({ initCount = 0, testId }: LocaleCounterProps) {
  const [count, setCount] = useState(initCount);
  const locale = getLocale();
  return (
    <div className="locale-counter">
      <p className="count" data-testid={testId}>
        {m.island_count_label({ count, locale })}
      </p>
      <button type="button" onClick={() => setCount((c) => c + 1)}>
        +1
      </button>
    </div>
  );
}
