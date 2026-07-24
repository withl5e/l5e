import { startServer } from '@withl5e/l5e/server';

startServer({
  root: process.cwd(),
  port: Number(process.env.PORT) || 5177,
  base: '/',
  publicDir: './public',
});
