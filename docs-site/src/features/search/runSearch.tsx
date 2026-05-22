import { getSearchIndex } from './search-index';
import { SearchResults, type SearchResultsStatus } from './SearchResults';
import type { DisplayHit, RawSearchHit, SnippetPart } from './types';

const MIN_QUERY = 2;
const MAX_RESULTS = 10;
const SNIPPET_LEN = 220;
const BEFORE_CTX = 80;

export async function runSearchAction(rawQuery: string) {
  const query = rawQuery.trim();

  let status: SearchResultsStatus;
  let hits: DisplayHit[];

  if (query.length < MIN_QUERY) {
    status = 'idle';
    hits = [];
  } else {
    const index = await getSearchIndex();
    const raw = index.search(query).slice(0, MAX_RESULTS) as RawSearchHit[];
    hits = raw.map(toDisplayHit);
    status = hits.length === 0 ? 'empty' : 'ok';
  }

  return <SearchResults status={status} query={query} hits={hits} />;
}

function toDisplayHit(hit: RawSearchHit): DisplayHit {
  const body = hit.body ?? '';
  // Prefer matched document terms; fall back to query terms if none.
  const terms = [...(hit.terms ?? []), ...(hit.queryTerms ?? [])].filter(Boolean);
  return {
    slug: hit.slug,
    title: hit.title,
    section: hit.section,
    parts: buildSnippetParts(body, terms),
  };
}

/**
 * Build a contextual snippet around the first matched term in `body`.
 * Returns the snippet as alternating highlighted / plain parts so the
 * renderer can wrap the matches in <mark>.
 *
 * - Centers the window ~80 chars before the first match.
 * - Aligns start/end to word boundaries where possible.
 * - Prefixes/suffixes the snippet with '…' when the window is interior.
 * - If no match is found in the body (e.g. hit was title-only), returns
 *   the opening of the body as a plain (unhighlighted) part.
 */
function buildSnippetParts(body: string, terms: string[]): SnippetPart[] {
  if (!body) return [];

  const lcBody = body.toLowerCase();
  const lcTerms = terms.map((t) => t.toLowerCase()).filter((t) => t.length > 0);

  // Find the earliest occurrence of any term.
  let firstIdx = -1;
  for (const t of lcTerms) {
    const idx = lcBody.indexOf(t);
    if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) firstIdx = idx;
  }

  let startIdx = 0;
  if (firstIdx !== -1) {
    startIdx = Math.max(0, firstIdx - BEFORE_CTX);
    if (startIdx > 0) {
      // Align to next word boundary within ~20 chars
      const next = body.indexOf(' ', startIdx);
      if (next !== -1 && next - startIdx < 20) startIdx = next + 1;
    }
  }

  let endIdx = Math.min(body.length, startIdx + SNIPPET_LEN);
  if (endIdx < body.length) {
    const prevSpace = body.lastIndexOf(' ', endIdx);
    if (prevSpace > startIdx + SNIPPET_LEN * 0.7) endIdx = prevSpace;
  }

  const window = body.slice(startIdx, endIdx);
  const lead = startIdx > 0 ? '…' : '';
  const trail = endIdx < body.length ? '…' : '';

  // Find term occurrences inside the window for highlighting.
  const lcWindow = window.toLowerCase();
  const ranges: Array<[number, number]> = [];
  for (const t of lcTerms) {
    let pos = 0;
    while (pos <= lcWindow.length - t.length) {
      const idx = lcWindow.indexOf(t, pos);
      if (idx === -1) break;
      ranges.push([idx, idx + t.length]);
      pos = idx + t.length;
    }
  }
  // Sort + merge overlapping ranges so split is clean.
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Array<[number, number]> = [];
  for (const [s, e] of ranges) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }

  // Split the window into parts based on merged ranges.
  const parts: SnippetPart[] = [];
  if (lead) parts.push({ text: lead, highlight: false });

  if (merged.length === 0) {
    parts.push({ text: window, highlight: false });
  } else {
    let cursor = 0;
    for (const [s, e] of merged) {
      if (s > cursor) parts.push({ text: window.slice(cursor, s), highlight: false });
      parts.push({ text: window.slice(s, e), highlight: true });
      cursor = e;
    }
    if (cursor < window.length) {
      parts.push({ text: window.slice(cursor), highlight: false });
    }
  }

  if (trail) parts.push({ text: trail, highlight: false });
  return parts;
}
