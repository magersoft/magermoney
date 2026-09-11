import { serve } from '@hono/node-server';
import { SystemClock } from '@magermoney/domain';
import { createApp } from './app.js';
import { loadEnv } from './shared/env.js';

const env = loadEnv();
const app = createApp({
  clock: new SystemClock(),
  jwtSecret: env.SUPABASE_JWT_SECRET,
  cronSecret: env.CRON_SECRET,
  exposeDocs: env.NODE_ENV !== 'production',
});

serve({ fetch: app.fetch, port: 3000 }, (i) => console.log(`api on http://localhost:${i.port}`));
