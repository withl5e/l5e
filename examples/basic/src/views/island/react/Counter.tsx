/** @jsxImportSource react */
import { useState } from 'react';

export interface CounterProps {
  initCount?: number;
  /**
   * Optional label rendered as-is. The e2e fixture passes a value containing
   * `$$` to guard the `$`-replacement fix in entry-server's fillSsrIslands.
   */
  label?: string;
}

export function Counter({ initCount = 0, label }: CounterProps) {
  const [count, setCount] = useState(initCount);
  return (
    <div className="counter">
      <p className="count">Count: {count}</p>
      {label ? <p className="label">{label}</p> : null}
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}
