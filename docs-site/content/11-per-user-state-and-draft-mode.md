---
title: Per-user state & draft mode
description: L5E is for public, cacheable pages. Don't ship per-user state; if you need draft mode, opt out of the cache.
section: Routing & Navigation
order: 11
---

# Per-user state & draft mode

L5E is built for **public pages** — pages that are cacheable, indexable, and identical
across visitors. That assumption shapes everything from the response shape (one HTML body
per URL) to the `Cache-Control` / `Cache-Tag` headers a loader emits.

If a page differs per visitor — account dashboard, signed-in checkout, personalized feed —
L5E is not the tool. The two consequences below are why.

## Why per-user state doesn't fit

- **CDN cache and "personalized" don't mix.** L5E's loader pushes `s-maxage` and
  `stale-while-revalidate` headers; the response goes into the CDN keyed by URL. A
  per-user page rendered for visitor A and cached at the edge serves the same HTML to
  visitor B, and C, and the crawler. That's not a corner case — that's the *default*.
- **SEO and personalization don't mix either.** Search bots see one URL, expect one
  canonical response. A page that looks different per visitor either confuses indexing
  or has to ship a public skeleton and hydrate per-user content client-side — at which
  point you're a SPA, and the SSR layer is busywork.

## What to use instead — CSR React, not SSR

Render the public shell with L5E, hydrate the per-user content in the browser:

- **CSR widget on a public page** — `useClientJs` (or a React island) mounts on a
  target div and fetches per-user data from an API.
- **Full SPA on a dedicated route** (`/app`, `/account/*`) — L5E serves a tiny shell
  that boots the SPA.
- **Backend API alongside** — the only thing that responds per request.

Why CSR, not SSR: server stays cacheable, no poisoning surface, no per-user render
work, and per-user surfaces don't need SEO anyway.

### Concrete example: a per-user widget via React island

The public page is rendered by L5E and drops a React island at the spot that needs
per-user content:

```tsx
// src/views/<some-page>/index.tsx — cacheable for every visitor
import { Fragment } from '@withl5e/l5e/jsx-runtime';
import { ClientIsland } from '@withl5e/l5e/island';

export default function SomePage() {
  return (
    <Fragment>
      <ClientIsland from="./react/UserPanel" mount="load" />
      <main>{/* public content */}</main>
    </Fragment>
  );
}
```

The island is a regular React component that runs only in the browser. It fetches the
per-user data from an API and renders it client-side:

```tsx
// src/views/<some-page>/react/UserPanel.tsx — CSR only
import { useEffect, useState } from 'react';

export default function UserPanel() {
  const [me, setMe] = useState<{ displayName: string } | null>(null);
  useEffect(() => {
    fetch('/api/me').then((r) => r.json()).then(setMe);
  }, []);
  if (!me) return <div class="user-panel">Loading…</div>;
  return <div class="user-panel">Welcome, {me.displayName}</div>;
}
```

The L5E response is identical for every visitor — cacheable, indexable, no per-user
data in the HTML. The personalization is one `fetch` after the page paints. Inside the
island the React component is yours to do anything with — `useState`, routing,
optimistic updates, full SPA features L5E doesn't try to replicate.

### When you'd reach for SSR-with-per-user instead

Rarely. The case is "this per-user page must SEO" (it doesn't — per-user means not
public) or "the initial paint must already have the user's data" (it almost never must
— "loading…" for 100ms is acceptable for a signed-in surface). When you do hit one of
those rare cases, L5E isn't the right tool: use a React SSR framework for that
specific surface and keep L5E for the public pages on the same domain.

## Draft / preview mode — the one exception

A preview link shared with editors fits L5E (per-URL, not per-visitor) — but the response
**must** opt out of the cache, or public visitors get the draft next.

**Today: zero everything.** Branch on `locals.preview` in the loader, set all three cache
fields to `0`, and drop the cache tags.

```ts
if (req.locals?.preview) {
  return { props: { article }, maxAge: 0, sMaxAge: 0, swr: 0 };
}
```

The most common mistake is leaving `swr` non-zero — that's the CDN's licence to keep
serving the draft after expiry.

**Coming next: `cache: 'private'`.** A future `LoaderResult` flag will emit
`Cache-Control: private, no-store` directly, so neither the CDN nor a shared proxy
stores the response regardless of `s-maxage`. Until that lands, the three-zeros recipe
above is the safe fallback.

## Quick check

If you're unsure whether a page belongs in L5E, ask:

1. Does this page have the same body for the crawler as for a signed-in visitor? If
   no → it's per-user, not L5E.
2. Is the data the same for everyone, or does it depend on who's asking? Same →
   L5E. Different → not L5E (or draft mode if "different" is just published vs draft).
3. Can the CDN safely cache this response for the next visitor? Yes → L5E. No →
   either draft mode with `0/0/0` cache, or not L5E at all.

Three yes-es and L5E is the right tool. Any "no" and you're either in draft territory
(cache off) or in per-user territory (different stack).
