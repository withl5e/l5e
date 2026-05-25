import { defineRoutes } from '@withl5e/l5e/router';

export default defineRoutes([
  { path: '/', view: 'home' },
  { path: '/actions', view: 'actions' },
  { path: '/blog/:slug{/page/:page}', view: 'blog' },
  { path: '/docs/*path', view: 'docs' },
]);
