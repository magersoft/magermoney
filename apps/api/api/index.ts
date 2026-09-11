import { handle } from 'hono/vercel';
import { CurrencyRegistry, SystemClock } from '@magermoney/domain';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/shared/env.js';
import { createSupabaseJwks } from '../src/shared/auth/jwt.js';
import { createDb } from '../src/shared/db/client.js';
import { PgProfileRepository } from '../src/modules/profiles/infrastructure/pg-profile-repository.js';
import { PgRateRepository } from '../src/modules/rates/infrastructure/pg-rate-repository.js';
import { OpenErApiProvider } from '../src/modules/rates/infrastructure/open-er-api-provider.js';
import { CoinGeckoProvider } from '../src/modules/rates/infrastructure/coingecko-provider.js';

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
  rateProviders: [new OpenErApiProvider(env.FIAT_RATES_URL), new CoinGeckoProvider(env.CRYPTO_RATES_URL)],
});

export default handle(app);
