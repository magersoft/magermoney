import { describe, expect, it } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import { requireUser } from '../src/shared/auth/middleware.js';
import { signTestToken } from './helpers/token.js';
import type { AppEnv } from '../src/app.js';

const secret = 'test-secret-test-secret-test-secret-1234';
const app = new OpenAPIHono<AppEnv>();
app.use('/me', requireUser(secret));
app.get('/me', (c) => c.json({ userId: c.var.userId }));

describe('requireUser', () => {
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
