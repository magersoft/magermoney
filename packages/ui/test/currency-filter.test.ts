import { describe, expect, it } from 'vitest';
import {
  filterCurrencies,
  groupCurrencies,
  type CurrencyOption,
} from '../src/components/currency-select/filter';

const fiat = (code: string, name: string, altName?: string, symbol?: string): CurrencyOption => ({
  code,
  kind: 'fiat',
  name,
  ...(altName === undefined ? {} : { altName }),
  ...(symbol === undefined ? {} : { symbol }),
});
const crypto = (code: string, name: string, symbol?: string): CurrencyOption => ({
  code,
  kind: 'crypto',
  name,
  ...(symbol === undefined ? {} : { symbol }),
});

/* In the English locale, with the Russian name still searchable. */
const OPTIONS: CurrencyOption[] = [
  fiat('COP', 'Colombian Peso', 'Колумбийский песо'),
  fiat('RUB', 'Russian Ruble', 'Российский рубль', '₽'),
  fiat('USD', 'US Dollar', 'Доллар США', '$'),
  fiat('UZS', 'Uzbekistani Som', 'Узбекский сум'),
  fiat('PEN', 'Peruvian Sol', 'Перуанский соль'),
  crypto('BTC', 'Bitcoin', '₿'),
  crypto('USDC', 'USD Coin'),
  crypto('USDT', 'Tether', '₮'),
];

const codes = (list: CurrencyOption[]) => list.map((o) => o.code);

describe('filterCurrencies', () => {
  it('returns everything, in the caller’s order, for an empty query', () => {
    expect(codes(filterCurrencies(OPTIONS, '  '))).toEqual(codes(OPTIONS));
  });

  it('puts an exact code first, ahead of every currency that merely starts with it', () => {
    expect(codes(filterCurrencies(OPTIONS, 'USDT'))[0]).toBe('USDT');
  });

  it('ranks the code above the name: "pe" offers the sol before the Colombian peso', () => {
    const found = codes(filterCurrencies(OPTIONS, 'pe'));
    expect(found.indexOf('PEN')).toBeLessThan(found.indexOf('COP'));
  });

  it('offers the dollar first for "us", which is what two letters usually mean', () => {
    expect(codes(filterCurrencies(OPTIONS, 'us'))[0]).toBe('USD');
  });

  it('finds USDT without switching to a crypto section', () => {
    expect(codes(filterCurrencies(OPTIONS, 'usdt'))).toContain('USDT');
  });

  it('matches the name of the current language', () => {
    expect(codes(filterCurrencies(OPTIONS, 'colombian'))).toEqual(['COP']);
  });

  it('matches the other language’s name too: «rubl» finds the ruble in English', () => {
    expect(codes(filterCurrencies(OPTIONS, 'рубл'))).toEqual(['RUB']);
    expect(codes(filterCurrencies(OPTIONS, 'песо'))).toEqual(['COP']);
  });

  it('matches any word of a name, so «песо» finds «Колумбийский песо»', () => {
    expect(codes(filterCurrencies(OPTIONS, 'som'))).toContain('UZS');
  });

  it('matches the symbol', () => {
    expect(codes(filterCurrencies(OPTIONS, '₿'))).toEqual(['BTC']);
  });

  it('ignores case and accents', () => {
    expect(codes(filterCurrencies(OPTIONS, 'COLOMBIAN'))).toEqual(['COP']);
  });

  it('returns nothing when nothing matches', () => {
    expect(filterCurrencies(OPTIONS, 'zzzzz')).toEqual([]);
  });

  it('keeps the caller’s order within one rank', () => {
    // USDC and USDT both match the code prefix; the list order decides.
    const found = codes(filterCurrencies(OPTIONS, 'usd'));
    expect(found.indexOf('USDC')).toBeLessThan(found.indexOf('USDT'));
  });
});

describe('groupCurrencies', () => {
  it('splits the matches into fiat and crypto', () => {
    const groups = groupCurrencies(OPTIONS, '');
    expect(groups.map((g) => g.id)).toEqual(['fiat', 'crypto']);
    expect(codes(groups[0]!.options)).toEqual(['COP', 'RUB', 'USD', 'UZS', 'PEN']);
    expect(codes(groups[1]!.options)).toEqual(['BTC', 'USDC', 'USDT']);
  });

  it('draws no group at all when it has no matches', () => {
    expect(groupCurrencies(OPTIONS, 'colombian').map((g) => g.id)).toEqual(['fiat']);
    expect(groupCurrencies(OPTIONS, 'bitcoin').map((g) => g.id)).toEqual(['crypto']);
  });

  it('puts the frequently used ones on top, in the order they were given', () => {
    const groups = groupCurrencies(OPTIONS, '', ['USD', 'RUB']);
    expect(groups[0]!.id).toBe('frequent');
    expect(codes(groups[0]!.options)).toEqual(['USD', 'RUB']);
    // Lifted out of the blocks below rather than repeated: one currency, one row.
    expect(codes(groups[1]!.options)).not.toContain('USD');
  });

  it('drops the split when the shortcut block is the whole answer', () => {
    expect(groupCurrencies(OPTIONS, 'colombian', ['COP']).map((g) => g.id)).toEqual(['fiat']);
    expect(codes(groupCurrencies(OPTIONS, 'colombian', ['COP'])[0]!.options)).toEqual(['COP']);
  });

  it('leaves a frequent code that does not match out of the shortcut block', () => {
    const groups = groupCurrencies(OPTIONS, 'usd', ['RUB', 'USD']);
    expect(codes(groups[0]!.options)).toEqual(['USD']);
  });

  it('returns nothing when the query matches nothing', () => {
    expect(groupCurrencies(OPTIONS, 'zzzzz', ['USD'])).toEqual([]);
  });
});
