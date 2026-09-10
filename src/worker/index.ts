import { Hono } from 'hono';

const app = new Hono<{ Bindings: CloudflareBindings }>()
  .basePath('/api')
  .get('/health', (c) => c.json({ status: 'ok' }));

export default app;
export type AppType = typeof app;
