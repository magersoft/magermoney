import { handle } from 'hono/vercel';
import { CurrencyRegistry, SystemClock } from '@magermoney/domain';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/shared/env.js';
import { createDb } from '../src/shared/db/client.js';
import { PgProfileRepository } from '../src/modules/profiles/infrastructure/pg-profile-repository.js';

const env = loadEnv();
const sql = createDb(env.DATABASE_URL);
const app = createApp({
  clock: new SystemClock(),
  jwtSecret: env.SUPABASE_JWT_SECRET,
  cronSecret: env.CRON_SECRET,
  exposeDocs: env.NODE_ENV !== 'production',
  profiles: new PgProfileRepository(sql),
  registry: CurrencyRegistry.default(),
});

export default handle(app);
