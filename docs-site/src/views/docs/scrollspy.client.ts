/**
 * TOC scroll-spy.
 * - Reads all anchor links in `.docs-toc__nav` and finds their target headings.
 * - Uses IntersectionObserver to track which heading is currently in view.
 * - Sets `aria-current="location"` on the matching TOC link.
 * - On initial load, honors location.hash; otherwise activates the first heading.
 */

const tocLinks = document.querySelectorAll<HTMLAnchorElement>(
  '.docs-toc__nav a[href^="#"]',
);

if (tocLinks.length > 0) {
  const linkById = new Map<string, HTMLAnchorElement>();
  tocLinks.forEach((link) => {
    const id = link.getAttribute('href')!.slice(1);
    if (id) linkById.set(id, link);
  });

  const headings: HTMLElement[] = [];
  linkById.forEach((_, id) => {
    const el = document.getElementById(id);
    if (el) headings.push(el);
  });

  // Preserve document order in case the DOM order doesn't match insertion order
  headings.sort((a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);

  let activeId: string | null = null;
  const visible = new Set<string>();

  function setActive(id: string | null): void {
    if (id === activeId) return;
    activeId = id;
    tocLinks.forEach((link) => link.removeAttribute('aria-current'));
    if (id) {
      const link = linkById.get(id);
      if (link) link.setAttribute('aria-current', 'location');
    }
  }

  function pickActive(): void {
    if (visible.size > 0) {
      // Topmost visible heading in document order
      const top = headings.find((h) => visible.has(h.id));
      if (top) {
        setActive(top.id);
        return;
      }
    }
    // Nothing visible — find the last heading above the viewport top
    const scrollTop = window.scrollY + 120;
    let last: HTMLElement | null = null;
    for (const h of headings) {
      if (h.offsetTop <= scrollTop) last = h;
      else break;
    }
    setActive(last?.id ?? headings[0]?.id ?? null);
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).id;
        if (entry.isIntersecting) visible.add(id);
        else visible.delete(id);
      }
      pickActive();
    },
    {
      // Activate when the heading enters the top 30% of the viewport,
      // and stays active until it scrolls out the top.
      rootMargin: '-10% 0px -70% 0px',
      threshold: 0,
    },
  );

  headings.forEach((h) => observer.observe(h));

  // Initial activation honors a #fragment in the URL, else picks the topmost
  const hashId = location.hash.slice(1);
  if (hashId && linkById.has(hashId)) {
    setActive(hashId);
  } else {
    // Defer so the IO has a chance to populate `visible`
    requestAnimationFrame(() => pickActive());
  }
}
