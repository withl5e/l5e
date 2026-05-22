/** Raw hit shape as returned by MiniSearch.search() with our storeFields. */
export interface RawSearchHit {
  id: string;
  score: number;
  /** Matched document terms (e.g. ['routing', 'route']) */
  terms?: string[];
  /** Original query terms */
  queryTerms?: string[];
  slug?: string;
  title?: string;
  section?: string;
  /** Full plain-text body — used to compute a contextual snippet at search time. */
  body?: string;
}

/** Snippet split into highlighted / non-highlighted pieces for rendering. */
export interface SnippetPart {
  text: string;
  highlight: boolean;
}

/** Hit shape passed to SearchResults — runSearch processes the body into parts. */
export interface DisplayHit {
  slug?: string;
  title?: string;
  section?: string;
  parts: SnippetPart[];
}
