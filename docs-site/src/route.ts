import { defineRoutes } from '@withl5e/l5e/router';

export default defineRoutes([
  { path: '/', view: 'home' },
  { path: '/sitemap.xml', view: 'sitemap' },
  { path: '/docs', view: 'docs' },
  { path: '/docs/:slug', view: 'docs' },
]);
