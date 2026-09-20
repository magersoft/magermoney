import { describe, expect, it } from 'vitest';
import { ok, err } from 'neverthrow';
import { FixedClock } from '@magermoney/domain';
import { fetchRates } from '../src/modules/rates/application/fetch-rates.js';
import { ProviderError } from '../src/modules/rates/application/rate-provider.js';
import { MemoryRateRepository } from '../src/modules/rates/infrastructure/memory-rate-repository.js';
import { createApp } from '../src/app.js';
import { testDeps } from './helpers/deps.js';

const clock = new FixedClock(new Date('2026-09-11T06:15:00Z'));
const fiat = {
  kind: 'fiat' as const,
  source: 'open-er-api' as const,
  fetch: async () =>
    ok([
      { base: 'EUR', value: '1.16' },
      { base: 'RUB', value: '0.0119' },
    ]),
};
const broken = {
  kind: 'crypto' as const,
  source: 'coingecko' as const,
  fetch: async () => err(new ProviderError('coingecko', 'boom')),
};

describe('fetchRates', () => {
  it("stores today's api rates for the requested kind only", async () => {
    const repo = new MemoryRateRepository();
    const res = await fetchRates(repo, [fiat, broken], clock)('fiat');
    expect(res._unsafeUnwrap()).toEqual({ stored: 2 });
    expect(repo.rows).toEqual([
      { base: 'EUR', quote: 'USD', value: '1.16', date: '2026-09-11', source: 'api', userId: null },
      {
        base: 'RUB',
        quote: 'USD',
        value: '0.0119',
        date: '2026-09-11',
        source: 'api',
        userId: null,
      },
    ]);
  });
  it('propagates provider failure', async () => {
    expect((await fetchRates(new MemoryRateRepository(), [broken], clock)('crypto')).isErr()).toBe(
      true,
    );
  });
  it('GET /jobs/rates runs the job for Vercel Cron with the cron secret', async () => {
    const app = createApp(testDeps({ rateProviders: [fiat], clock }));
    expect((await app.request('/jobs/rates?kind=fiat')).status).toBe(401);
    const res = await app.request('/jobs/rates?kind=fiat', {
      headers: { authorization: 'Bearer cron' },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ stored: 2 });
  });
  it('POST /jobs/rates requires the cron secret', async () => {
    const app = createApp(testDeps({ rateProviders: [fiat], clock }));
    expect((await app.request('/jobs/rates?kind=fiat', { method: 'POST' })).status).toBe(401);
    const ok2 = await app.request('/jobs/rates?kind=fiat', {
      method: 'POST',
      headers: { authorization: 'Bearer cron' },
    });
    expect(ok2.status).toBe(200);
    expect(await ok2.json()).toEqual({ stored: 2 });
  });
});
