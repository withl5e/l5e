import type { GenerateMetadataFunction } from '@withl5e/l5e/entry-server';

export const generateMetadata: GenerateMetadataFunction = () => ({
  title: 'L5E — HTML-first SSR for content-heavy apps',
  description:
    'L5E renders the whole page server-side, sets cache headers, and lets your CDN do the rest. No streaming, no SSG juggling — just predictable HTML.',
});
