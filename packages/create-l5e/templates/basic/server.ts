import { startServer } from '@l5e/core/server';

startServer({
  root: process.cwd(),
  port: Number(process.env.PORT) || 5173,
  base: '/',
  publicDir: './public',
});
