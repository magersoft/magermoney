import { handle } from 'hono/vercel';
import { SystemClock } from '@magermoney/domain';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/shared/env.js';

const env = loadEnv();
const app = createApp({
  clock: new SystemClock(),
  jwtSecret: env.SUPABASE_JWT_SECRET,
  cronSecret: env.CRON_SECRET,
  exposeDocs: env.NODE_ENV !== 'production',
});

export default handle(app);
