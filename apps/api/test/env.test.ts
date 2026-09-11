import { describe, expect, it } from 'vitest';
import { assertJwtConfigured, loadEnv } from '../src/shared/env.js';

const base = {
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  CRON_SECRET: 'cron-secret',
};

describe('env', () => {
  it('loads without SUPABASE_JWT_SECRET when SUPABASE_URL provides JWKS', () => {
    const env = loadEnv({ ...base, SUPABASE_URL: 'http://127.0.0.1:54321' });
    expect(env.SUPABASE_JWT_SECRET).toBeUndefined();
    expect(() => assertJwtConfigured(env)).not.toThrow();
  });

  it('accepts the HS256 secret alone', () => {
    const env = loadEnv({ ...base, SUPABASE_JWT_SECRET: 'a'.repeat(32) });
    expect(() => assertJwtConfigured(env)).not.toThrow();
  });

  it('refuses to boot when neither verification source is configured', () => {
    expect(() => assertJwtConfigured(loadEnv({ ...base }))).toThrow(/SUPABASE_URL/);
  });

  it('parses CORS_ORIGINS as a trimmed list and defaults to the dev origin', () => {
    expect(loadEnv({ ...base }).CORS_ORIGINS).toEqual(['http://localhost:5173']);
    expect(loadEnv({ ...base, CORS_ORIGINS: 'https://a.dev, https://b.dev' }).CORS_ORIGINS).toEqual(
      ['https://a.dev', 'https://b.dev'],
    );
  });

  it('reads ALLOW_VERCEL_PREVIEWS as a boolean, off by default', () => {
    expect(loadEnv({ ...base }).ALLOW_VERCEL_PREVIEWS).toBe(false);
    expect(loadEnv({ ...base, ALLOW_VERCEL_PREVIEWS: 'true' }).ALLOW_VERCEL_PREVIEWS).toBe(true);
  });
});
