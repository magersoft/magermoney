import { describe, expect, it } from 'vitest';
import {
  CurrencyRegistry,
  Decimal,
  Money,
  RateTable,
  availableUntilPayday,
  groupByProvider,
  totalCapital,
  type Account,
  type Rate,
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
const table = new RateTable('2026-09-11', [rate('EUR', '1.16'), rate('RUB', '0.0119')], reg);

const acc = (over: Partial<Account> & { balance: Money }): Account => ({
  id: over.balance.currency.code + (over.name ?? ''),
  name: 'A',
  bank: 'Bank',
  country: 'RU',
  kind: 'bank_account',
  cardType: null,
  isSpending: false,
  sortOrder: 0,
  archived: false,
  ...over,
});

describe('totalCapital', () => {
  it('sums every active account in the display currency', () => {
    const r = totalCapital(
      [acc({ balance: Money.of('100', c('USD')) }), acc({ balance: Money.of('100', c('EUR')) })],
      table,
      c('USD'),
    );
    expect(r.total.round().toString()).toBe('216');
    expect(r.unconvertible).toEqual([]);
  });
  it('skips archived accounts and lists the ones it cannot convert', () => {
    const noRate = acc({ name: 'x', balance: Money.of('1', c('BTC')) });
    const r = totalCapital(
      [
        acc({ balance: Money.of('5', c('USD')), archived: true }),
        noRate,
        acc({ balance: Money.of('7', c('USD')) }),
      ],
      table,
      c('USD'),
    );
    expect(r.total.toString()).toBe('7');
    expect(r.unconvertible).toEqual([noRate]);
  });
});

describe('availableUntilPayday', () => {
  it('sums only spending accounts', () => {
    const r = availableUntilPayday(
      [
        acc({ balance: Money.of('30', c('USD')), isSpending: true }),
        acc({ balance: Money.of('1000', c('USD')) }),
      ],
      table,
      c('USD'),
    );
    expect(r.total.toString()).toBe('30');
  });
});

describe('groupByProvider', () => {
  it('groups active accounts by bank, ordered by the first sortOrder, accounts by sortOrder then name', () => {
    const groups = groupByProvider([
      acc({ name: 'b', bank: 'Binance', sortOrder: 5, balance: Money.of('1', c('BTC')) }),
      acc({ name: 'z', bank: 'Alfa', sortOrder: 2, balance: Money.of('1', c('RUB')) }),
      acc({ name: 'a', bank: 'Binance', sortOrder: 5, balance: Money.of('1', c('ETH')) }),
      acc({
        name: 'old',
        bank: 'Alfa',
        sortOrder: 0,
        archived: true,
        balance: Money.of('1', c('RUB')),
      }),
    ]);
    expect(groups.map((g) => g.bank)).toEqual(['Alfa', 'Binance']);
    expect(groups[1]?.accounts.map((a) => a.name)).toEqual(['a', 'b']);
    expect(groups[0]?.accounts).toHaveLength(1);
  });
});
