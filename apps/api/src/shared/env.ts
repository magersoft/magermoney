import { z } from 'zod';

const csv = (raw: string) =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const schema = z.object({
  DATABASE_URL: z.string().url(),
  // Either of the two verifies a Supabase JWT: the JWKS derived from
  // SUPABASE_URL (ES256/RS256) or the legacy shared secret (HS256).
  // Boot fails when both are missing; see `assertJwtConfigured`.
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_JWT_SECRET: z.string().min(32).optional(),
  CRON_SECRET: z.string().min(8),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://127.0.0.1:5173')
    .transform(csv)
    .pipe(z.array(z.string()).min(1)),
  ALLOW_VERCEL_PREVIEWS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  FIAT_RATES_URL: z.string().url().default('https://open.er-api.com/v6/latest/USD'),
  CRYPTO_RATES_URL: z.string().url().default('https://api.coingecko.com/api/v3/simple/price'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof schema>;

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => schema.parse(source);

/**
 * A running API must be able to verify user tokens. Fail loudly at boot rather
 * than answering every authenticated request with a 401.
 */
export function assertJwtConfigured(env: Env): void {
  if (!env.SUPABASE_URL && !env.SUPABASE_JWT_SECRET)
    throw new Error(
      'JWT verification is not configured: set SUPABASE_URL (JWKS) or SUPABASE_JWT_SECRET (HS256 fallback).',
    );
}
