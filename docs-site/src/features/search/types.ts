export interface SearchHit {
  id: string;
  score: number;
  slug?: string;
  title?: string;
  section?: string;
  snippet?: string;
}
