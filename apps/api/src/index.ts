import { serve } from '@hono/node-server';
import { CurrencyRegistry, SystemClock } from '@magermoney/domain';
import { createApp } from './app.js';
import { loadEnv } from './shared/env.js';
import { createSupabaseJwks } from './shared/auth/jwt.js';
import { createDb } from './shared/db/client.js';
import { PgProfileRepository } from './modules/profiles/infrastructure/pg-profile-repository.js';
import { PgRateRepository } from './modules/rates/infrastructure/pg-rate-repository.js';
import { OpenErApiProvider } from './modules/rates/infrastructure/open-er-api-provider.js';
import { CoinGeckoProvider } from './modules/rates/infrastructure/coingecko-provider.js';

const env = loadEnv();
const sql = createDb(env.DATABASE_URL);
const app = createApp({
  clock: new SystemClock(),
  jwtSecret: env.SUPABASE_JWT_SECRET,
  jwks: createSupabaseJwks(env.SUPABASE_URL),
  cronSecret: env.CRON_SECRET,
  exposeDocs: env.NODE_ENV !== 'production',
  profiles: new PgProfileRepository(sql),
  registry: CurrencyRegistry.default(),
  rates: new PgRateRepository(sql),
  rateProviders: [
    new OpenErApiProvider(env.FIAT_RATES_URL),
    new CoinGeckoProvider(env.CRYPTO_RATES_URL),
  ],
});

serve({ fetch: app.fetch, port: 3000 }, (i) => console.log(`api on http://localhost:${i.port}`));
