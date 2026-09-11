import { describe, expect, it } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import { SignJWT, exportJWK, generateKeyPair, createLocalJWKSet } from 'jose';
import { requireUser } from '../src/shared/auth/middleware.js';
import { signTestToken } from './helpers/token.js';
import type { AppEnv } from '../src/app.js';

const secret = 'test-secret-test-secret-test-secret-1234';

function buildApp(opts: { jwks?: ReturnType<typeof createLocalJWKSet> | undefined; secret?: string | undefined }) {
  const app = new OpenAPIHono<AppEnv>();
  app.use('/me', requireUser(opts));
  app.get('/me', (c) => c.json({ userId: c.var.userId }));
  return app;
}

async function signEs256Token(sub: string, kid: string, privateKey: CryptoKey) {
  return new SignJWT({ role: 'authenticated', aud: 'authenticated' })
    .setProtectedHeader({ alg: 'ES256', kid })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);
}

describe('requireUser (HS256 secret)', () => {
  const app = buildApp({ secret });

  it('rejects a missing token', async () => {
    const res = await app.request('/me');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: 'UNAUTHORIZED', message: 'Sign in required' });
  });
  it('rejects a token signed with another secret', async () => {
    const t = await signTestToken('u1', 'x'.repeat(40));
    expect((await app.request('/me', { headers: { authorization: `Bearer ${t}` } })).status).toBe(401);
  });
  it('rejects an expired token', async () => {
    const t = await signTestToken('u1', secret, '-1s');
    expect((await app.request('/me', { headers: { authorization: `Bearer ${t}` } })).status).toBe(401);
  });
  it('accepts a valid token and exposes userId', async () => {
    const t = await signTestToken('11111111-1111-1111-1111-111111111111', secret);
    const res = await app.request('/me', { headers: { authorization: `Bearer ${t}` } });
    expect(await res.json()).toEqual({ userId: '11111111-1111-1111-1111-111111111111' });
  });
});

describe('requireUser (ES256 JWKS)', () => {
  it('accepts a valid ES256 token verified through JWKS', async () => {
    const { publicKey, privateKey } = await generateKeyPair('ES256');
    const kid = 'test-kid-1';
    const jwk = await exportJWK(publicKey);
    const jwks = createLocalJWKSet({ keys: [{ ...jwk, kid, alg: 'ES256' }] });
    const app = buildApp({ jwks });

    const t = await signEs256Token('22222222-2222-2222-2222-222222222222', kid, privateKey);
    const res = await app.request('/me', { headers: { authorization: `Bearer ${t}` } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: '22222222-2222-2222-2222-222222222222' });
  });

  it('rejects an ES256 token when only secret is configured', async () => {
    const { kid, token } = await (async () => {
      const { privateKey } = await generateKeyPair('ES256');
      const kid = 'test-kid-2';
      const token = await signEs256Token('u1', kid, privateKey);
      return { kid, token };
    })();
    const app = buildApp({ secret });
    const res = await app.request('/me', { headers: { authorization: `Bearer ${token}` } });
    expect(res.status).toBe(401);
    void kid;
  });

  it('rejects an HS256 token when only jwks is configured', async () => {
    const { publicKey } = await generateKeyPair('ES256');
    const jwk = await exportJWK(publicKey);
    const jwks = createLocalJWKSet({ keys: [{ ...jwk, kid: 'unused', alg: 'ES256' }] });
    const app = buildApp({ jwks });

    const t = await signTestToken('u1', secret);
    const res = await app.request('/me', { headers: { authorization: `Bearer ${t}` } });
    expect(res.status).toBe(401);
  });

  it('rejects a token with an unknown/unsupported alg', async () => {
    const app = buildApp({ jwks: undefined, secret });
    const garbage = 'not.a.jwt';
    const res = await app.request('/me', { headers: { authorization: `Bearer ${garbage}` } });
    expect(res.status).toBe(401);
  });
});
