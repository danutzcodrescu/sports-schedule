import { Hono } from 'hono';
import { createAuth } from './auth/auth';

const app = new Hono<{ Bindings: CloudflareBindings }>()
  .basePath('/api')
  .on(['GET', 'POST'], '/auth/*', (c) => createAuth(c.env).handler(c.req.raw))
  .get('/health', (c) => c.json({ status: 'ok' }));

export default app;
export type AppType = typeof app;
