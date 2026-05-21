import { getSearchIndex } from './search-index';
import { SearchResults, type SearchResultsStatus } from './SearchResults';
import type { SearchHit } from './types';

const MIN_QUERY = 2;
const MAX_RESULTS = 10;

export async function runSearchAction(rawQuery: string) {
  const query = rawQuery.trim();

  let status: SearchResultsStatus;
  let hits: SearchHit[];

  if (query.length < MIN_QUERY) {
    status = 'idle';
    hits = [];
  } else {
    const index = await getSearchIndex();
    hits = index.search(query).slice(0, MAX_RESULTS) as SearchHit[];
    status = hits.length === 0 ? 'empty' : 'ok';
  }

  return <SearchResults status={status} query={query} hits={hits} />;
}
