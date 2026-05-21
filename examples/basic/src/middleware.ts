import { defineMiddleware, sequence } from '@l5e/core/middleware';

const rewriteDemo = defineMiddleware((context, next) => {
  if (context.url.pathname === '/rewrite-demo') {
    return next('/');
  }

  return next();
});

const addPoweredBy = defineMiddleware(async (_context, next) => {
  const response = await next();
  response.headers.set('x-powered-by', 'L5E');
  return response;
});

export const onRequest = sequence(rewriteDemo, addPoweredBy);
