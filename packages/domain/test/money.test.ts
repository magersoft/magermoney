import { describe, expect, it } from 'vitest';
import {
  CurrencyMismatchError,
  CurrencyRegistry,
  InvalidAmountError,
  Money,
} from '../src/index.js';

const reg = CurrencyRegistry.default();
const USD = reg.get('USD')._unsafeUnwrap();
const EUR = reg.get('EUR')._unsafeUnwrap();
const BTC = reg.get('BTC')._unsafeUnwrap();

describe('Money', () => {
  it('adds and subtracts same-currency amounts exactly', () => {
    const a = Money.of('0.1', USD);
    const b = Money.of('0.2', USD);
    expect(a.add(b)._unsafeUnwrap().toString()).toBe('0.3');
    expect(b.subtract(a)._unsafeUnwrap().toString()).toBe('0.1');
  });

  it('refuses to mix currencies', () => {
    const e = Money.of('1', USD).add(Money.of('1', EUR))._unsafeUnwrapErr();
    expect(e).toBeInstanceOf(CurrencyMismatchError);
    expect(Money.of('1', USD).compare(Money.of('1', EUR)).isErr()).toBe(true);
  });

  it('rounds to the currency scale, half up', () => {
    expect(Money.of('1.005', USD).round().toString()).toBe('1.01');
    expect(Money.of('0.123456789', BTC).round().toString()).toBe('0.12345679');
  });

  it('multiplies by a factor and keeps precision until round', () => {
    expect(Money.of('10', USD).multiply('0.15').toString()).toBe('1.5');
    expect(Money.of('2100675.19', USD).multiply('0.0000847').round().toString()).toBe('177.93');
  });

  it('compares, detects zero and negative', () => {
    expect(Money.of('1', USD).compare(Money.of('2', USD))._unsafeUnwrap()).toBe(-1);
    expect(Money.of('0', USD).isZero()).toBe(true);
    expect(Money.of('-3', USD).isNegative()).toBe(true);
  });

  it('parses strings and rejects garbage', () => {
    expect(Money.parse('24715.00', USD)._unsafeUnwrap().toString()).toBe('24715');
    expect(Money.parse('abc', USD)._unsafeUnwrapErr()).toBeInstanceOf(InvalidAmountError);
    expect(Money.parse('', USD).isErr()).toBe(true);
    expect(Money.parse('NaN', USD).isErr()).toBe(true);
    expect(Money.parse('Infinity', USD).isErr()).toBe(true);
  });

  it('serialises to a JSON shape with a decimal string', () => {
    expect(JSON.parse(JSON.stringify(Money.of('1.50', EUR)))).toEqual({
      amount: '1.5',
      currency: 'EUR',
    });
  });
});
