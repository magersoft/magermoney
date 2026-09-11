import { describe, expect, it } from 'vitest';
import {
  CurrencyRegistry,
  Money,
  RateMissingError,
  RateTable,
  UnknownCurrencyError,
  type Rate,
  Decimal,
} from '../src/index.js';

const reg = CurrencyRegistry.default();
const c = (code: string) => reg.get(code)._unsafeUnwrap();
const rate = (base: string, value: string): Rate => ({
  base,
  quote: 'USD',
  value: new Decimal(value),
  date: '2026-09-11',
  source: 'api',
});
const table = new RateTable(
  '2026-09-11',
  [rate('EUR', '1.16'), rate('RUB', '0.011911'), rate('BTC', '77389.36'), rate('USD', '1')],
  reg,
);

describe('RateTable', () => {
  it('converts through USD as the cross currency', () => {
    expect(
      table
        .convert(Money.of('100', c('EUR')), 'USD')
        ._unsafeUnwrap()
        .toString(),
    ).toBe('116');
    expect(
      table
        .convert(Money.of('116', c('USD')), 'EUR')
        ._unsafeUnwrap()
        .round()
        .toString(),
    ).toBe('100');
    expect(
      table
        .convert(Money.of('1', c('BTC')), 'RUB')
        ._unsafeUnwrap()
        .round()
        .toString(),
    ).toBe('6497301.65');
  });

  it('is identity for the same currency', () => {
    expect(
      table
        .convert(Money.of('5', c('EUR')), 'EUR')
        ._unsafeUnwrap()
        .toString(),
    ).toBe('5');
  });

  it('fails with RateMissingError when a leg is missing', () => {
    const e = table.convert(Money.of('1', c('EUR')), 'KZT')._unsafeUnwrapErr();
    expect(e).toBeInstanceOf(RateMissingError);
    expect((e as RateMissingError).base).toBe('KZT');
  });

  it('fails with UnknownCurrencyError for an unknown target', () => {
    expect(table.convert(Money.of('1', c('EUR')), 'XYZ')._unsafeUnwrapErr()).toBeInstanceOf(
      UnknownCurrencyError,
    );
  });

  it('never returns NaN or zero for a missing rate', () => {
    const empty = new RateTable('2026-09-11', [], reg);
    expect(empty.rateOf('EUR').isErr()).toBe(true);
  });

  it('treats a stored zero rate as missing', () => {
    const t = new RateTable('2026-09-11', [rate('EUR', '0')], reg);
    expect(t.rateOf('EUR')._unsafeUnwrapErr()).toBeInstanceOf(RateMissingError);
    expect(t.convert(Money.of('1', c('EUR')), 'USD')._unsafeUnwrapErr()).toBeInstanceOf(
      RateMissingError,
    );
  });

  it('treats a stored infinite rate as missing', () => {
    const t = new RateTable(
      '2026-09-11',
      [
        {
          base: 'EUR',
          quote: 'USD',
          value: new Decimal(Infinity),
          date: '2026-09-11',
          source: 'api',
        },
      ],
      reg,
    );
    expect(t.rateOf('EUR')._unsafeUnwrapErr()).toBeInstanceOf(RateMissingError);
    expect(t.convert(Money.of('1', c('EUR')), 'USD')._unsafeUnwrapErr()).toBeInstanceOf(
      RateMissingError,
    );
  });
});
