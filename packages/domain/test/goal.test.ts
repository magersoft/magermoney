import { describe, expect, it } from 'vitest';
import {
  CurrencyRegistry,
  Decimal,
  Money,
  RateTable,
  goalForecast,
  goalProgress,
  FORECAST_MIN_MONTHS,
  type Account,
  type Goal,
  type MonthlyBalance,
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

const series = (...totals: number[]): MonthlyBalance[] =>
  totals.map((n, i) => ({
    month: { year: 2026, month: i + 1 },
    total: Money.of(new Decimal(n), EUR),
  }));

describe('goalForecast', () => {
  const progressOf = (funded: number) =>
    goalProgress(goal, [account({ balance: Money.of(new Decimal(funded), EUR) })], table);

  it('divides what is left by the average monthly growth', () => {
    // 1000 → 3000 over two steps = 1000 a month; 7000 left = 7 months from
    // today — and a month is 30 days here, so seven of them land on 11 October,
    // four days short of the calendar's seventh 15th.
    const f = goalForecast(goal, progressOf(3_000), series(1_000, 2_000, 3_000), '2026-03-15');
    expect(f).toEqual({ kind: 'date', on: '2026-10-11', monthlyRate: expect.anything() });
    if (f.kind === 'date') expect(f.monthlyRate.amount.toString()).toBe('1000');
  });

  it('says nothing when there is less than two months of history', () => {
    expect(goalForecast(goal, progressOf(1_000), series(1_000), '2026-01-15')).toEqual({
      kind: 'none',
      reason: 'not_enough_history',
    });
    expect(FORECAST_MIN_MONTHS).toBe(2);
  });

  it('says nothing when the balance is not advancing', () => {
    expect(
      goalForecast(goal, progressOf(2_000), series(3_000, 2_500, 2_000), '2026-03-15'),
    ).toEqual({ kind: 'none', reason: 'not_advancing' });
  });

  it('says nothing for a goal already reached', () => {
    expect(
      goalForecast(goal, progressOf(10_000), series(1_000, 5_000, 10_000), '2026-03-15'),
    ).toEqual({ kind: 'none', reason: 'achieved' });
  });

  it('says nothing when the balance is standing still', () => {
    // Zero is not "advancing slowly": decimal.js calls zero positive, and
    // dividing by it gives Infinity, which is not a date.
    expect(
      goalForecast(goal, progressOf(2_000), series(2_000, 2_000, 2_000), '2026-03-15'),
    ).toEqual({ kind: 'none', reason: 'not_advancing' });
  });

  it('says nothing when the date is further off than anyone plans', () => {
    // A euro a month against ten thousand: positive, and about 833 years out.
    expect(goalForecast(goal, progressOf(0), series(1, 2, 3), '2026-03-15')).toEqual({
      kind: 'none',
      reason: 'too_far',
    });
  });

  it('reads at most the last six months', () => {
    // Nine months of history; only the last six (5000 → 8000, 600 a month) count.
    const f = goalForecast(
      goal,
      progressOf(8_000),
      series(100, 200, 300, 5_000, 5_600, 6_200, 6_800, 7_400, 8_000),
      '2026-09-15',
    );
    if (f.kind !== 'date') throw new Error('expected a date');
    expect(f.monthlyRate.amount.toString()).toBe('600');
  });
});
