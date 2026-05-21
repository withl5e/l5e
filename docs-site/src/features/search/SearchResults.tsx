import { Fragment } from '@withl5e/l5e/jsx-runtime';

import type { SearchHit } from './types';

export type SearchResultsStatus = 'idle' | 'empty' | 'ok';

export interface SearchResultsProps {
  status: SearchResultsStatus;
  query: string;
  hits: SearchHit[];
}

export function SearchResults({ status, query, hits }: SearchResultsProps) {
  if (status === 'idle') {
    return <Fragment />;
  }

  if (status === 'empty') {
    return (
      <div class="search-panel search-panel--empty">
        <p class="search-panel__empty-line">
          No matches for "<strong>{query}</strong>"
        </p>
        <p class="search-panel__empty-hint">Try a different keyword or a single word.</p>
      </div>
    );
  }

  return (
    <div class="search-panel">
      <div class="search-panel__header">
        <span>
          {hits.length} result{hits.length === 1 ? '' : 's'}
        </span>
        <span class="search-panel__kbd">Esc to close</span>
      </div>
      <ul class="search-panel__list">
        {hits.map((hit) => (
          <li class="search-hit">
            <a class="search-hit__link" href={`/docs/${hit.slug}`}>
              <span class="search-hit__section">{hit.section}</span>
              <span class="search-hit__title">{hit.title}</span>
              {hit.snippet ? (
                <span class="search-hit__snippet">{hit.snippet}…</span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
