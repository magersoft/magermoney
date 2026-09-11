import { CurrencyRegistry, SystemClock } from '@magermoney/domain';
import type { AppDeps } from './app.js';
import { assertJwtConfigured, type Env } from './shared/env.js';
import { createSupabaseJwks } from './shared/auth/jwt.js';
import { createDb } from './shared/db/client.js';
import { PgProfileRepository } from './modules/profiles/infrastructure/pg-profile-repository.js';
import { PgRateRepository } from './modules/rates/infrastructure/pg-rate-repository.js';
import { OpenErApiProvider } from './modules/rates/infrastructure/open-er-api-provider.js';
import { CoinGeckoProvider } from './modules/rates/infrastructure/coingecko-provider.js';

/** Shared by the node server (`src/index.ts`) and the Vercel function (`api/index.ts`). */
export function depsFromEnv(env: Env): AppDeps {
  assertJwtConfigured(env);
  const sql = createDb(env.DATABASE_URL);
  return {
    clock: new SystemClock(),
    jwtSecret: env.SUPABASE_JWT_SECRET,
    jwks: env.SUPABASE_URL ? createSupabaseJwks(env.SUPABASE_URL) : undefined,
    cronSecret: env.CRON_SECRET,
    exposeDocs: env.NODE_ENV !== 'production',
    corsOrigins: env.CORS_ORIGINS,
    allowVercelPreviews: env.ALLOW_VERCEL_PREVIEWS,
    profiles: new PgProfileRepository(sql),
    registry: CurrencyRegistry.default(),
    rates: new PgRateRepository(sql),
    rateProviders: [
      new OpenErApiProvider(env.FIAT_RATES_URL),
      new CoinGeckoProvider(env.CRYPTO_RATES_URL),
    ],
  };
}
