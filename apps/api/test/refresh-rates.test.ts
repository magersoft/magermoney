import { describe, expect, it } from 'vitest';
import { ok, err } from 'neverthrow';
import { CurrencyRegistry, FixedClock } from '@magermoney/domain';
import {
  refreshRates,
  REFRESH_INTERVAL_MS,
} from '../src/modules/rates/application/refresh-rates.js';
import { ProviderError } from '../src/modules/rates/application/rate-provider.js';
import { MemoryRateRepository } from '../src/modules/rates/infrastructure/memory-rate-repository.js';
import { createApp } from '../src/app.js';
import { testDeps } from './helpers/deps.js';
import { signTestToken } from './helpers/token.js';

const now = new Date('2026-09-20T09:00:00Z');
const clock = new FixedClock(now);
const uid = '11111111-1111-1111-1111-111111111111';
const secret = 'test-secret-test-secret-test-secret-1234';
const auth = async () => ({ authorization: `Bearer ${await signTestToken(uid, secret)}` });

const fiat = () => {
  let calls = 0;
  return {
    kind: 'fiat' as const,
    fetch: async () => {
      calls++;
      return ok([
        { base: 'EUR', value: '1.16' },
        { base: 'RUB', value: '0.0119' },
      ]);
    },
    get calls() {
      return calls;
    },
  };
};
const crypto = {
  kind: 'crypto' as const,
  fetch: async () => ok([{ base: 'BTC', value: '64000' }]),
};
const broken = {
  kind: 'fiat' as const,
  fetch: async () => err(new ProviderError('open-er-api', 'boom')),
};

const registry = CurrencyRegistry.default();

describe('refreshRates', () => {
  it('fetches every kind and reports what it stored', async () => {
    const repo = new MemoryRateRepository();
    const res = await refreshRates(repo, [fiat(), crypto], registry, clock)();
    expect(res._unsafeUnwrap()).toEqual({
      stored: 3,
      refreshed: true,
      refreshedAt: now.toISOString(),
    });
    expect(repo.rows.map((r) => r.base).sort()).toEqual(['BTC', 'EUR', 'RUB']);
  });

  it('answers that the rates are already fresh without calling a provider', async () => {
    const repo = new MemoryRateRepository([], clock);
    const provider = fiat();
    await refreshRates(repo, [provider], registry, clock)();
    expect(provider.calls).toBe(1);

    const again = await refreshRates(repo, [provider], registry, clock)();
    expect(provider.calls).toBe(1);
    expect(again._unsafeUnwrap()).toEqual({
      stored: 0,
      refreshed: false,
      refreshedAt: now.toISOString(),
    });
  });

  it('goes back to the providers once the interval has passed', async () => {
    const repo = new MemoryRateRepository([], clock);
    const provider = fiat();
    await refreshRates(repo, [provider], registry, clock)();
    const later = new FixedClock(new Date(now.getTime() + REFRESH_INTERVAL_MS + 1000));
    const res = await refreshRates(repo, [provider], registry, later)();
    expect(provider.calls).toBe(2);
    expect(res._unsafeUnwrap().refreshed).toBe(true);
  });

  it('propagates a provider failure', async () => {
    const res = await refreshRates(new MemoryRateRepository(), [broken], registry, clock)();
    expect(res.isErr()).toBe(true);
  });
});

describe('POST /rates/refresh', () => {
  it('requires a signed-in user', async () => {
    const app = createApp(testDeps({ rateProviders: [fiat()], clock }));
    expect((await app.request('/rates/refresh', { method: 'POST' })).status).toBe(401);
  });

  it('refreshes the rates for the signed-in user', async () => {
    const rates = new MemoryRateRepository();
    const app = createApp(testDeps({ rates, rateProviders: [fiat(), crypto], clock }));
    const res = await app.request('/rates/refresh', { method: 'POST', headers: await auth() });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      stored: 3,
      refreshed: true,
      refreshedAt: now.toISOString(),
    });
  });

  it('answers 200 with refreshed=false when the rates are still fresh', async () => {
    const rates = new MemoryRateRepository([], clock);
    const app = createApp(testDeps({ rates, rateProviders: [fiat()], clock }));
    await app.request('/rates/refresh', { method: 'POST', headers: await auth() });
    const res = await app.request('/rates/refresh', { method: 'POST', headers: await auth() });
    expect(res.status).toBe(200);
    expect((await res.json()).refreshed).toBe(false);
  });

  it('turns a provider failure into a 502 the client can read', async () => {
    const app = createApp(testDeps({ rateProviders: [broken], clock }));
    const res = await app.request('/rates/refresh', { method: 'POST', headers: await auth() });
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe('PROVIDER_FAILED');
  });
});
