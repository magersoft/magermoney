import { serve } from '@hono/node-server';
import { CurrencyRegistry, SystemClock } from '@magermoney/domain';
import { createApp } from './app.js';
import { loadEnv } from './shared/env.js';
import { createDb } from './shared/db/client.js';
import { PgProfileRepository } from './modules/profiles/infrastructure/pg-profile-repository.js';
import { PgRateRepository } from './modules/rates/infrastructure/pg-rate-repository.js';

const env = loadEnv();
const sql = createDb(env.DATABASE_URL);
const app = createApp({
  clock: new SystemClock(),
  jwtSecret: env.SUPABASE_JWT_SECRET,
  cronSecret: env.CRON_SECRET,
  exposeDocs: env.NODE_ENV !== 'production',
  profiles: new PgProfileRepository(sql),
  registry: CurrencyRegistry.default(),
  rates: new PgRateRepository(sql),
});

serve({ fetch: app.fetch, port: 3000 }, (i) => console.log(`api on http://localhost:${i.port}`));
