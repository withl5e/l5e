interface SwapResponseProps {
  children: JSX.Element | JSX.Element[];
  hasMore?: boolean;
  meta?: Record<string, string>;
}

export function SwapResponse({ children, hasMore, meta }: SwapResponseProps) {
  return (
    <div
      data-has-more={hasMore !== undefined ? String(hasMore) : undefined}
      {...(meta && Object.fromEntries(Object.entries(meta).map(([k, v]) => [`data-${k}`, v])))}
    >
      {children}
    </div>
  );
}
