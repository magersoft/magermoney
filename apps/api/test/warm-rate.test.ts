import { describe, expect, it } from 'vitest';
import { ok } from 'neverthrow';
import { FixedClock } from '@magermoney/domain';
import { warmRate } from '../src/modules/rates/application/warm-rate.js';
import { MemoryRateRepository } from '../src/modules/rates/infrastructure/memory-rate-repository.js';
import type { QuotableCurrency } from '../src/modules/rates/application/rate-provider.js';

const clock = new FixedClock(new Date('2026-09-20T12:00:00Z'));

describe('warmRate', () => {
  it('stores today’s rate for one currency, so it is not blank until tonight', async () => {
    const repo = new MemoryRateRepository([], clock);
    repo.connectedCodes = new Set(['EUR']);
    let asked: QuotableCurrency[] = [];
    const provider = {
      kind: 'fiat' as const,
      source: 'open-er-api' as const,
      fetch: async (c: QuotableCurrency[]) => {
        asked = c;
        return ok([{ base: 'EUR', value: '1.16' }]);
      },
    };

    await warmRate(repo, [provider], clock)('EUR');

    // One code, not the whole list: this runs on a tap, not on a schedule.
    expect(asked.map((c) => c.code)).toEqual(['EUR']);
    expect(repo.rows).toEqual([
      { base: 'EUR', quote: 'USD', value: '1.16', date: '2026-09-20', source: 'api', userId: null },
    ]);
  });

  it('does nothing for a currency no provider quotes', async () => {
    const repo = new MemoryRateRepository([], clock);
    repo.currencies = repo.currencies.map((c) => ({ ...c, rateSource: null }));
    let calls = 0;
    const provider = {
      kind: 'fiat' as const,
      source: 'open-er-api' as const,
      fetch: async () => {
        calls++;
        return ok([]);
      },
    };

    await warmRate(repo, [provider], clock)('EUR');
    expect(calls).toBe(0);
    expect(repo.rows).toEqual([]);
  });

  it('asks the provider whose source the currency belongs to', async () => {
    const repo = new MemoryRateRepository([], clock);
    repo.connectedCodes = new Set(['BTC']);
    const calls: string[] = [];
    const make = (kind: 'fiat' | 'crypto', source: 'open-er-api' | 'coingecko') => ({
      kind,
      source,
      fetch: async () => {
        calls.push(source);
        return ok([{ base: 'BTC', value: '77000' }]);
      },
    });

    await warmRate(repo, [make('fiat', 'open-er-api'), make('crypto', 'coingecko')], clock)('BTC');
    expect(calls).toEqual(['coingecko']);
  });
});
