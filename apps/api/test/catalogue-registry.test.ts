import { describe, expect, it } from 'vitest';
import type { CurrencyDto } from '@magermoney/contracts';
import { FixedClock } from '@magermoney/domain';
import { CatalogueRegistry } from '../src/modules/rates/infrastructure/catalogue-registry.js';
import { MemoryRateRepository } from '../src/modules/rates/infrastructure/memory-rate-repository.js';
import { fetchRates } from '../src/modules/rates/application/fetch-rates.js';
import type { QuotableCurrency } from '../src/modules/rates/application/rate-provider.js';

const currency = (over: Partial<CurrencyDto> & Pick<CurrencyDto, 'code'>): CurrencyDto => ({
  kind: 'fiat',
  scale: 2,
  symbol: null,
  nameRu: null,
  nameEn: null,
  icon: null,
  rateSource: 'open-er-api',
  ...over,
});

describe('CatalogueRegistry', () => {
  it('answers from the catalogue, so a currency added by migration needs no release', async () => {
    const repo = new MemoryRateRepository();
    repo.currencies = [currency({ code: 'COP' }), currency({ code: 'BHD', scale: 3 })];
    const registry = new CatalogueRegistry(repo);
    await registry.ready();

    expect(registry.has('COP')).toBe(true);
    expect(registry.get('BHD')._unsafeUnwrap().scale).toBe(3);
    // Not in this catalogue, however familiar the code.
    expect(registry.has('USD')).toBe(false);
  });

  it('refuses to answer before it is loaded rather than calling everything unknown', () => {
    const registry = new CatalogueRegistry(new MemoryRateRepository());
    expect(() => registry.has('USD')).toThrow(/before it was loaded/);
  });

  it('loads once, and shares one query between concurrent callers', async () => {
    const repo = new MemoryRateRepository();
    let queries = 0;
    repo.listCurrencies = async () => {
      queries++;
      return [currency({ code: 'USD' })];
    };
    const registry = new CatalogueRegistry(repo);
    await Promise.all([registry.ready(), registry.ready(), registry.ready()]);
    await registry.ready();
    expect(queries).toBe(1);
  });

  it('reloads once the snapshot has gone stale', async () => {
    const repo = new MemoryRateRepository();
    let queries = 0;
    repo.listCurrencies = async () => {
      queries++;
      return [currency({ code: 'USD' })];
    };
    let now = 0;
    const registry = new CatalogueRegistry(repo, () => now);
    await registry.ready();
    now = 60 * 60 * 1000;
    await registry.ready();
    expect(queries).toBe(2);
  });
});

describe('fetchRates against the catalogue', () => {
  const clock = new FixedClock(new Date('2026-09-20T06:00:00Z'));

  it('asks each provider only about the currencies it is the source for', async () => {
    const repo = new MemoryRateRepository();
    repo.currencies = [
      currency({ code: 'COP' }),
      currency({ code: 'KPW', rateSource: null }),
      currency({ code: 'BTC', kind: 'crypto', scale: 8, rateSource: 'coingecko' }),
    ];
    let asked: QuotableCurrency[] = [];
    const provider = {
      kind: 'fiat' as const,
      source: 'open-er-api' as const,
      fetch: async (c: QuotableCurrency[]) => {
        asked = c;
        const { ok } = await import('neverthrow');
        return ok([{ base: 'COP', value: '0.00025' }]);
      },
    };

    const res = await fetchRates(repo, [provider], clock)('fiat');

    expect(res._unsafeUnwrap()).toEqual({ stored: 1 });
    // North Korea's won has no source, so it is never asked for — and so never
    // comes back as a rate that is really a zero. Bitcoin belongs to the other
    // provider.
    expect(asked.map((c) => c.code)).toEqual(['COP']);
  });

  it('skips a provider the catalogue has nothing for instead of calling it empty', async () => {
    const repo = new MemoryRateRepository();
    repo.currencies = [currency({ code: 'KPW', rateSource: null })];
    let calls = 0;
    const provider = {
      kind: 'fiat' as const,
      source: 'open-er-api' as const,
      fetch: async () => {
        calls++;
        const { ok } = await import('neverthrow');
        return ok([]);
      },
    };

    expect((await fetchRates(repo, [provider], clock)('fiat'))._unsafeUnwrap()).toEqual({
      stored: 0,
    });
    expect(calls).toBe(0);
  });
});
