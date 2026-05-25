import { defineRoutes } from '@withl5e/l5e/router';

export default defineRoutes([
  { path: '/', view: 'home' },
  { path: '/actions', view: 'actions' },
  { path: '/blog/$slug', view: 'blog' },
  { path: '/docs/$', view: 'docs' },
]);
