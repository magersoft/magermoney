import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { MemoryRateRepository } from '../src/modules/rates/infrastructure/memory-rate-repository.js';
import { testDeps } from './helpers/deps.js';
import { signTestToken } from './helpers/token.js';
const uid = '11111111-1111-1111-1111-111111111111';
const secret = 'test-secret-test-secret-test-secret-1234';
describe('PUT /rates/manual', () => {
  it('stores a manual rate for the caller and returns it', async () => {
    const rates = new MemoryRateRepository();
    const app = createApp(testDeps({ rates, jwtSecret: secret }));
    const res = await app.request('/rates/manual', {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${await signTestToken(uid, secret)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ base: 'RUB', date: '2026-09-10', value: '0.011855' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      base: 'RUB',
      quote: 'USD',
      value: '0.011855',
      date: '2026-09-10',
      source: 'manual',
    });
    expect(rates.rows[0]?.userId).toBe(uid);
  });
  it('400s on an unknown currency', async () => {
    const app = createApp(testDeps({ jwtSecret: secret }));
    const res = await app.request('/rates/manual', {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${await signTestToken(uid, secret)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ base: 'XYZ', date: '2026-09-10', value: '1' }),
    });
    expect(res.status).toBe(400);
  });
});
