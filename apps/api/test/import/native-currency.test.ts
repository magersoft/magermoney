import { describe, expect, it } from 'vitest';
import { parsePercent, parseRuDate } from '../../scripts/import/numbers.js';
import { findBlock, cellOf } from '../../scripts/import/block.js';
import { isWhole, parseCurrencyOf, pickNative } from '../../scripts/import/native-currency.js';

const opts = (currencyOf: [string, string][] = [], fallback = 'EUR') => ({
  currencyOf: new Map(currencyOf),
  fallback,
});

describe('parsePercent', () => {
  it('turns a sheet percent into a fraction', () => {
    expect(parsePercent('15%')).toBe('0.15');
    expect(parsePercent('7,5 %')).toBe('0.075');
    expect(parsePercent('0%')).toBe('0');
    expect(parsePercent('')).toBe('0');
  });
  it('rejects what is not a rate below 100 %', () => {
    expect(parsePercent('100%')).toBeNull();
    expect(parsePercent('-5%')).toBeNull();
    expect(parsePercent('n/a')).toBeNull();
  });
});

describe('parseRuDate', () => {
  it('reads DD.MM.YYYY', () => {
    expect(parseRuDate('23.01.2025')).toBe('2025-01-23');
    expect(parseRuDate(' 01.12.2024 ')).toBe('2024-12-01');
  });
  it('rejects other shapes and impossible dates', () => {
    expect(parseRuDate('2025-01-23')).toBeNull();
    expect(parseRuDate('31.02.2025')).toBeNull();
    expect(parseRuDate('')).toBeNull();
  });
});

describe('findBlock', () => {
  const rows = [
    ['', '', '', ''],
    ['Позиция', 'USD', 'EUR', '', 'Позиция', 'USD'],
    ['Rent', '1', '2', '', 'Sofa', '9'],
  ];
  it('stops at the first empty header cell, so the neighbour block never leaks in', () => {
    const block = findBlock(rows, 'Позиция')._unsafeUnwrap();
    expect(block.headerRow).toBe(1);
    expect([...block.columns]).toEqual([
      ['Позиция', 0],
      ['USD', 1],
      ['EUR', 2],
    ]);
    expect(cellOf(block, rows[2]!, 'USD')).toBe('1');
    expect(cellOf(block, rows[2]!, 'RUB')).toBe('');
    expect(cellOf(block, ['Rent'], 'EUR')).toBe('');
  });
  it('fails when the header is missing', () => {
    expect(findBlock(rows, 'Источник').isErr()).toBe(true);
  });
});

describe('parseCurrencyOf', () => {
  it('splits on the last "=" so a name may contain one', () => {
    expect([...parseCurrencyOf(['Deposit=RUB', 'A=B = USD'])._unsafeUnwrap()]).toEqual([
      ['Deposit', 'RUB'],
      ['A=B', 'USD'],
    ]);
  });
  it('rejects a pair without a name or with a malformed code', () => {
    expect(parseCurrencyOf(['Deposit']).isErr()).toBe(true);
    expect(parseCurrencyOf(['=RUB']).isErr()).toBe(true);
    expect(parseCurrencyOf(['Deposit=rub']).isErr()).toBe(true);
  });
});

describe('pickNative', () => {
  it('knows a whole amount by the missing dot', () => {
    expect(isWhole('1400')).toBe(true);
    expect(isWhole('1400.5')).toBe(false);
  });
  it('takes the only round amount', () => {
    expect(
      pickNative('Rent', { USD: '1377.05', EUR: '1200', RUB: '116366.40' }, opts())._unsafeUnwrap(),
    ).toEqual({ currency: 'EUR', amount: '1200', ambiguous: false });
  });
  it('falls back and flags the row when two amounts are round', () => {
    expect(
      pickNative('Music', { USD: '3', EUR: '2.61', RUB: '254' }, opts())._unsafeUnwrap(),
    ).toEqual({ currency: 'EUR', amount: '2.61', ambiguous: true });
  });
  it('falls back and flags the row when no amount is round', () => {
    expect(
      pickNative(
        'Deposit',
        { USD: '41.07', EUR: '37.85', RUB: '3485.20' },
        opts([], 'RUB'),
      )._unsafeUnwrap(),
    ).toEqual({ currency: 'RUB', amount: '3485.20', ambiguous: true });
  });
  it('does not count zero as a round amount', () => {
    expect(pickNative('Idle', { USD: '0', EUR: '0', RUB: '0' }, opts())._unsafeUnwrap()).toEqual({
      currency: 'EUR',
      amount: '0',
      ambiguous: true,
    });
  });
  it('lets --currency-of win over the guess', () => {
    expect(
      pickNative(
        'Music',
        { USD: '3', EUR: '2.61', RUB: '254' },
        opts([['Music', 'USD']]),
      )._unsafeUnwrap(),
    ).toEqual({ currency: 'USD', amount: '3', ambiguous: false });
  });
  it('fails when the override or the fallback has no column', () => {
    expect(pickNative('Music', { USD: '2', EUR: null }, opts([['Music', 'GBP']])).isErr()).toBe(
      true,
    );
    expect(pickNative('Music', { USD: '2.5', RUB: '200.1' }, opts()).isErr()).toBe(true);
  });
});
