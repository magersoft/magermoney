import { describe, expect, it } from 'vitest';
import {
  CurrencyRegistry,
  Decimal,
  Money,
  RateTable,
  goalProgress,
  type Account,
  type Goal,
  type Rate,
} from '../src/index.js';

const registry = CurrencyRegistry.sample();
const c = (code: string) => registry.get(code)._unsafeUnwrap();
const EUR = c('EUR');
const USD = c('USD');
const rate = (base: string, value: string): Rate => ({
  base,
  quote: 'USD',
  value: new Decimal(value),
  date: '2026-09-21',
  source: 'api',
});
const table = new RateTable('2026-09-21', [rate('EUR', '1.1')], registry);

const account = (over: Partial<Account> & { balance: Money }): Account => ({
  id: 'a',
  name: 'A',
  bank: 'B',
  country: 'DE',
  kind: 'bank_account',
  cardType: null,
  isSpending: false,
  isPinned: false,
  sortOrder: 0,
  archived: false,
  ...over,
});

const goal: Goal = {
  id: 'g',
  name: 'Car',
  icon: null,
  target: Money.of(new Decimal(10_000), EUR),
  targetDate: null,
  achievedAt: null,
  archivedAt: null,
  sortOrder: 0,
};

describe('goalProgress', () => {
  it('sums the linked accounts in the goal currency', () => {
    const p = goalProgress(
      goal,
      [
        account({ balance: Money.of(new Decimal(2_000), EUR) }),
        account({ id: 'b', balance: Money.of(new Decimal(1_100), USD) }), // = 1000 EUR
      ],
      table,
    );
    expect(p.funded.amount.toString()).toBe('3000');
    expect(p.remaining.amount.toString()).toBe('7000');
    expect(p.ratio).toBeCloseTo(0.3);
    expect(p.unconvertible).toEqual([]);
  });

  it('lists an account it cannot price instead of counting it as zero', () => {
    const btc = account({ id: 'c', balance: Money.of(new Decimal(1), c('BTC')) });
    const p = goalProgress(goal, [btc], table);
    expect(p.funded.amount.toString()).toBe('0');
    expect(p.unconvertible.map((a) => a.id)).toEqual(['c']);
  });

  it('calls a goal with nothing left to reach complete rather than undefined', () => {
    // `target_amount > 0` is a check constraint, so this shape never arrives
    // from the database — the guard is what keeps the ratio a number anyway.
    const p = goalProgress({ ...goal, target: Money.zero(EUR) }, [], table);
    expect(p.ratio).toBe(1);
    expect(p.remaining.amount.toString()).toBe('0');
  });

  it('clamps an overfunded goal at zero remaining and ratio 1', () => {
    const p = goalProgress(goal, [account({ balance: Money.of(new Decimal(12_000), EUR) })], table);
    expect(p.remaining.amount.toString()).toBe('0');
    expect(p.ratio).toBe(1);
  });
});
