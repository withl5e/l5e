---
title: Why L5E
description: A short walk through 15 years of how we shipped HTML, the gap L5E fills, and the honest tradeoffs.
section: Welcome
order: 1
---

# Why L5E

A short walk through how the web has shipped HTML, and where L5E fits in the picture.

## The PHP / WordPress era

The server rendered the page, sent clean HTML, and that was the page. A change to the
footer? Edit one field - every request after that picked it up. CDN cached the HTML if
traffic spiked, busted it on save. The script tags in `<head>` were a few KB of jQuery
or a small custom file. Bundles were tiny because the page was tiny.

It worked. The reason a lot of the web still ran on this stack in 2026 wasn't
inertia - the output was hard to beat for content.

## The React era

Components became how we wanted to write UI. JSX is genuinely better at composition
than templating, and people who'd already adopted React for an SPA wanted the same
ergonomics on their content pages. Reasonable.

The first answer was a SPA: ship a JS bundle, render in the browser, fetch JSON for
data. SEO and first-paint problems pushed teams toward SSR. SSR + hydrate solved a
lot, but every page rendered twice - once on the server, once in the browser - and
the bundle carried every component the route might use, not just the ones that
rendered.

## The meta-framework era

Next.js, Remix, Nuxt, Astro, SvelteKit, Qwik - each tackles a serious problem with a
serious answer: per-route code splitting, file-system routing, edge runtime, partial
hydration, streaming, server components, RSC payloads, ISR. They are the right tool
when the product is built around them.

For a content site, though, the answers come with their own bills:

- **SSG rebuilds the world.** A typo in the footer means CI re-emitting 2,000 pages.
  The CDN was already happy to cache HTML for you; the build step pre-computing it is
  a thing you opted into.
- **ISR is `s-maxage` + `stale-while-revalidate` if you already have a CDN.**
  Cloudflare gives you that for free, and it's transparent - the HTTP headers say
  exactly what's happening.
- **Block-builder pages don't fit either tooling cleanly.** A CMS hands the route a
  different composition of blocks per URL. The bundler can offer two paths:
  1. One big route bundle that imports every possible block - even the ones this URL
     doesn't render.
  2. Per-block `dynamic` import - bundle shrinks, but the HTML grows into a manifest
     of 30+ `<script>` and `<link rel="modulepreload">` tags.
- **Nested block builders compound the problem.** Vite's tree-shaking runs at build
  time with static information; it can't see that Block A only loads Block B for one
  CMS document and Block C for another. The conservative thing it can do is ship
  both.

None of this is a criticism of those frameworks - they're solving for different
shapes than a content site. It just means a content site ends up paying for features
it didn't need.

## The shape some of us actually want

A lot of the web is still:

- Pages of content, identical for every visitor (and for the crawler).
- A few small interactions on top - a search box, a "load more", one interactive
  widget.
- A CDN in front that's already happy to cache by URL.

For that shape, the PHP-era output was the right answer. Clean HTML, one CSS link,
one (or zero) script tags, the CDN doing the work. **We just want components on top
of it.**

L5E is that. JSX on the server, rendered into a clean HTML body, plus a per-request
bundler that only includes assets the blocks that actually rendered registered. Add a
13th block to the page builder; URLs that don't render it pay nothing.

Why can't a build-time bundler just do this? Tree-shaking is static - it knows which code
*could* run, not which blocks *this* request renders from *its* data. Try to pick blocks
dynamically and you trade one problem for another: a variable import like
`import('../blocks/' + type + '.astro')` makes the bundler pull in *every* candidate block - a
long-standing, documented Astro limitation
([withastro/astro#4863](https://github.com/withastro/astro/issues/4863)) - while splitting each
block into its own chunk pushes the decision to the browser: load the shell, run JS, fetch
data, discover it needs blocks 7 / 12 / 30, then fetch each chunk, a round-trip at a time.
Rendering on the server skips all of that - the data is already there, so the exact set is
known the moment render finishes.

## The honest tradeoffs

L5E gives up things to keep the output shape simple. Knowing what they are matters
more than knowing what it's good at:

- **No streaming SSR.** The response goes out as one block. You can't progressively
  flush the header before the data is ready.
- **No SSG / ISR pre-computation.** Every request renders fresh; CDN caching is
  doing the work the build step would have done.
- **No client-side routing.** Links are real navigations. Fast enough on a quick
  origin; not what you want for an app-feeling SPA.
- **No first-class per-user SSR.** The framework is built around a cacheable
  response; per-user surfaces are a CSR concern. See
  [[11-per-user-state-and-draft-mode]].

These aren't oversights. They're how the output stays clean and the framework stays
small enough to read top-to-bottom.

## Not a toy, not vibe coding

L5E has been running in production on three public content sites for a while now.
The domains aren't listed here - but what matters for this page is that the
framework was already proving itself in real traffic before any of this was
published. The Search Console signals on those sites - stable indexing, healthy
Core Web Vitals, predictable crawl coverage - were the cue to open-source it.

<div class="figure-grid">
  <figure class="figure">
    <img src="/screenshots/site-1.png" alt="Search Console signals for production site #1 running on L5E" />
    <figcaption>Production site #1 - Search Console snapshot.</figcaption>
  </figure>
  <figure class="figure">
    <img src="/screenshots/site-2.png" alt="Search Console signals for production site #2 running on L5E" />
    <figcaption>Production site #2 - Search Console snapshot.</figcaption>
  </figure>
  <figure class="figure">
    <img src="/screenshots/site-3.png" alt="Search Console signals for production site #3 running on L5E" />
    <figcaption>Production site #3 - Search Console snapshot.</figcaption>
  </figure>
</div>

Strong SEO numbers still depend on experienced SEO work behind the scenes - the
framework doesn't replace that. What it does is keep the technical baseline out of
the way: clean HTML, predictable cache headers, fast first paint. With that
foundation, the SEO team's work isn't fighting the stack.

The framework was open-sourced because the problem isn't unique to those three
sites, and the answer is portable enough to be useful to anyone facing the same
shape.

## When not to use L5E

- **App-shaped products** - dashboards, editors, chat, real-time collaboration. The
  meta-frameworks were designed for this; use one.
- **Per-user content as the default** - signed-in feeds, account pages, anything
  where the HTML differs per visitor. L5E can host the marketing surface; the SPA
  or React SSR app holds the per-user one on the same domain.
- **Pages whose first paint must already have personalised data** - rare, but real.
  A React SSR framework with per-user request boundaries is the right tool there.
- **No CDN in front.** L5E's cache story assumes a CDN is doing the caching.
  Without one the framework still works, but you give up most of the speed advantage.

Rule of thumb: same HTML for every visitor → L5E fits. Different HTML per visitor →
another stack will serve you better.
