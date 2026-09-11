import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  SUPABASE_JWT_SECRET: z.string().min(32),
  CRON_SECRET: z.string().min(8),
  FIAT_RATES_URL: z.string().url().default('https://open.er-api.com/v6/latest/USD'),
  CRYPTO_RATES_URL: z.string().url().default('https://api.coingecko.com/api/v3/simple/price'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof schema>;

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => schema.parse(source);
