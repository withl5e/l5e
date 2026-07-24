/** @jsxImportSource react */
import { useState } from 'react';
import { m } from '~/paraglide/messages.js';
import type { Locale } from '~/paraglide/runtime.js';

export interface LocaleCounterProps {
  locale: Locale;
  initCount?: number;
  testId: string;
}

// Runs in the browser — there is no AsyncLocalStorage there, so unlike every
// server-rendered piece of this demo, `locale` can't be read ambiently here.
// It has to be passed in as an explicit prop from whatever server-rendered
// view mounts this island (see src/views/home/index.tsx). This is the one
// deliberate exception to "no prop-drilling" in the whole demo, and it's
// exactly the boundary where that exception is unavoidable.
export function LocaleCounter({ locale, initCount = 0, testId }: LocaleCounterProps) {
  const [count, setCount] = useState(initCount);
  return (
    <div className="locale-counter">
      <p className="count" data-testid={testId}>
        {m.island_count_label({ count, locale }, { locale })}
      </p>
      <button type="button" onClick={() => setCount((c) => c + 1)}>
        +1
      </button>
    </div>
  );
}
