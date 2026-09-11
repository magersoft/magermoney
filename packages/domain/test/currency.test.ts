import { describe, expect, it } from 'vitest';
import { CurrencyRegistry, UnknownCurrencyError } from '../src/index.js';

describe('CurrencyRegistry', () => {
  it('knows the default fiat and crypto currencies', () => {
    const r = CurrencyRegistry.default();
    expect(r.get('USD')._unsafeUnwrap()).toEqual({ code: 'USD', kind: 'fiat', scale: 2 });
    expect(r.get('BTC')._unsafeUnwrap()).toEqual({ code: 'BTC', kind: 'crypto', scale: 8, symbol: '₿' });
    expect(r.has('USDT')).toBe(true);
  });

  it('fails with UnknownCurrencyError for an unknown code', () => {
    const err = CurrencyRegistry.default().get('XYZ')._unsafeUnwrapErr();
    expect(err).toBeInstanceOf(UnknownCurrencyError);
    expect(err.code).toBe('UNKNOWN_CURRENCY');
    expect(err.message).toContain('XYZ');
  });

  it('accepts a custom list and rejects duplicates', () => {
    const r = new CurrencyRegistry([{ code: 'ABC', kind: 'fiat', scale: 2 }]);
    expect(r.all()).toHaveLength(1);
    expect(() => new CurrencyRegistry([{ code: 'A', kind: 'fiat', scale: 2 }, { code: 'A', kind: 'fiat', scale: 2 }])).toThrow(/duplicate/i);
  });
});
