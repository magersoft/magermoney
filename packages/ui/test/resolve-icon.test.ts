import { describe, expect, it } from 'vitest';
import { resolveCurrencyIcon } from '../src/components/currency-icon/resolve-icon.js';
describe('resolveCurrencyIcon', () => {
  it('uses a circle flag for fiat by country', () => {
    expect(resolveCurrencyIcon({ code: 'USD', kind: 'fiat' })).toEqual({
      kind: 'iconify',
      name: 'circle-flags:us',
    });
    expect(resolveCurrencyIcon({ code: 'EUR', kind: 'fiat' })).toEqual({
      kind: 'iconify',
      name: 'circle-flags:european-union',
    });
    expect(resolveCurrencyIcon({ code: 'UZS', kind: 'fiat' })).toEqual({
      kind: 'iconify',
      name: 'circle-flags:uz',
    });
  });
  it('uses cryptocurrency-color by ticker for crypto', () => {
    expect(resolveCurrencyIcon({ code: 'BTC', kind: 'crypto' })).toEqual({
      kind: 'iconify',
      name: 'cryptocurrency-color:btc',
    });
  });
  it('prefers an explicit override', () => {
    expect(resolveCurrencyIcon({ code: 'PEPE', kind: 'crypto', icon: 'local:pepe' })).toEqual({
      kind: 'iconify',
      name: 'local:pepe',
    });
  });
  it('falls back to initials for unknown fiat', () => {
    expect(resolveCurrencyIcon({ code: 'ZZZ', kind: 'fiat' })).toEqual({
      kind: 'initials',
      text: 'ZZ',
    });
  });
});

describe('resolveCurrencyIcon with a country', () => {
  it('uses the country flag for a fiat the table does not know', () => {
    expect(resolveCurrencyIcon({ code: 'NOK', kind: 'fiat', country: 'NO' })).toEqual({
      kind: 'iconify',
      name: 'circle-flags:no',
    });
  });
});
