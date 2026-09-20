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
  /*
   * The whole point of the change: an account is held somewhere, and where it is
   * held is a truer thing to draw than what it is denominated in. A Portuguese
   * euro account is Portuguese.
   */
  it('prefers the country over the currency table', () => {
    expect(resolveCurrencyIcon({ code: 'EUR', kind: 'fiat', country: 'PT' })).toEqual({
      kind: 'iconify',
      name: 'circle-flags:pt',
    });
  });
  it('falls back to the currency flag when the account has no country', () => {
    expect(resolveCurrencyIcon({ code: 'EUR', kind: 'fiat', country: null })).toEqual({
      kind: 'iconify',
      name: 'circle-flags:european-union',
    });
    expect(resolveCurrencyIcon({ code: 'EUR', kind: 'fiat', country: '' })).toEqual({
      kind: 'iconify',
      name: 'circle-flags:european-union',
    });
  });
  it('ignores a country on a crypto account', () => {
    expect(resolveCurrencyIcon({ code: 'BTC', kind: 'crypto', country: 'PT' })).toEqual({
      kind: 'iconify',
      name: 'cryptocurrency-color:btc',
    });
  });
  it('still prefers an explicit icon over the country', () => {
    expect(
      resolveCurrencyIcon({ code: 'EUR', kind: 'fiat', country: 'PT', icon: 'local:eur' }),
    ).toEqual({ kind: 'iconify', name: 'local:eur' });
  });
});
