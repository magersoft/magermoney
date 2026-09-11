import { describe, expect, it } from 'vitest';
import { FixedClock } from '@magermoney/domain';
import { createApp } from '../src/app.js';
import { MemoryRateRepository } from '../src/modules/rates/infrastructure/memory-rate-repository.js';
import { testDeps } from './helpers/deps.js';
import { signTestToken } from './helpers/token.js';

const uid = '11111111-1111-1111-1111-111111111111';
const other = '22222222-2222-2222-2222-222222222222';
const secret = 'test-secret-test-secret-test-secret-1234';
const auth = async () => ({ authorization: `Bearer ${await signTestToken(uid, secret)}` });
const rates = new MemoryRateRepository([
  { base: 'EUR', quote: 'USD', value: '1.15', date: '2026-09-09', source: 'api', userId: null },
  { base: 'EUR', quote: 'USD', value: '1.16', date: '2026-09-10', source: 'api', userId: null },
  { base: 'RUB', quote: 'USD', value: '0.0119', date: '2026-09-10', source: 'api', userId: null },
  { base: 'RUB', quote: 'USD', value: '0.0120', date: '2026-09-10', source: 'manual', userId: uid },
  {
    base: 'KZT',
    quote: 'USD',
    value: '0.0022',
    date: '2026-09-10',
    source: 'manual',
    userId: other,
  },
]);
const app = createApp(
  testDeps({ rates, jwtSecret: secret, clock: new FixedClock(new Date('2026-09-11T00:00:00Z')) }),
);

describe('GET /rates', () => {
  it('returns the newest rate per base on or before the date, manual beating api for the caller', async () => {
    const res = await app.request('/rates?date=2026-09-10', { headers: await auth() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.find((r: { base: string }) => r.base === 'EUR')).toMatchObject({
      value: '1.16',
      source: 'api',
    });
    expect(body.find((r: { base: string }) => r.base === 'RUB')).toMatchObject({
      value: '0.0120',
      source: 'manual',
    });
    expect(body.find((r: { base: string }) => r.base === 'KZT')).toBeUndefined();
  });
  it('defaults to today and falls back to older rates', async () => {
    const body = await (await app.request('/rates', { headers: await auth() })).json();
    expect(body.find((r: { base: string }) => r.base === 'EUR').date).toBe('2026-09-10');
  });
  it('lists currencies', async () => {
    const body = await (await app.request('/currencies', { headers: await auth() })).json();
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty('scale');
  });
});
