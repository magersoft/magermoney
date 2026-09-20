import { describe, expect, it } from 'vitest';
import {
  CurrencyRegistry,
  EXPENSE_PERIODS,
  Money,
  monthlyAmount,
  occurrencesBetween,
  type Expense,
} from '../src/index.js';

const reg = CurrencyRegistry.sample();
const EUR = reg.get('EUR')._unsafeUnwrap();

const expense = (over: Partial<Expense> = {}): Expense => ({
  id: 'e1',
  categoryId: 'c1',
  name: 'Rent',
  amount: Money.of('900', EUR),
  period: 'monthly',
  billingDay: 5,
  billingMonth: null,
  isEssential: true,
  activeFrom: '2025-01-01',
  activeTo: null,
  ...over,
});
const on = (e: Expense, from: string, to: string) =>
  occurrencesBetween(e, from, to).map((o) => o.date);

describe('monthlyAmount', () => {
  it('lists the two periods', () => {
    expect(EXPENSE_PERIODS).toEqual(['monthly', 'yearly']);
  });
  it('is the amount itself for a monthly expense', () => {
    expect(monthlyAmount(expense()).toString()).toBe('900');
  });
  it('spreads a yearly expense over twelve months, rounded to the currency scale', () => {
    expect(
      monthlyAmount(expense({ period: 'yearly', amount: Money.of('100', EUR) })).toString(),
    ).toBe('8.33');
  });
});

describe('occurrencesBetween', () => {
  it('charges a monthly expense every month on its billing day, for the full amount', () => {
    const r = occurrencesBetween(expense(), '2026-09-01', '2026-11-04');
    expect(r.map((o) => o.date)).toEqual(['2026-09-05', '2026-10-05']);
    expect(r[0]?.amount.toString()).toBe('900');
  });
  it('clamps billing day 31 to the end of a shorter month', () => {
    expect(on(expense({ billingDay: 31 }), '2026-02-01', '2026-02-28')).toEqual(['2026-02-28']);
  });
  it('charges a yearly expense once, also across a year boundary', () => {
    const yearly = expense({
      period: 'yearly',
      billingDay: 15,
      billingMonth: 1,
    });
    expect(on(yearly, '2026-09-17', '2027-09-16')).toEqual(['2027-01-15']);
    expect(on(yearly, '2026-01-16', '2026-12-31')).toEqual([]);
    expect(occurrencesBetween(yearly, '2027-01-01', '2027-01-31')[0]?.amount.toString()).toBe(
      '900',
    );
  });
  it('has nothing to show without a billing day, or a yearly expense without a billing month', () => {
    expect(on(expense({ billingDay: null }), '2026-09-01', '2026-09-30')).toEqual([]);
    expect(
      on(expense({ period: 'yearly', billingMonth: null }), '2026-01-01', '2026-12-31'),
    ).toEqual([]);
  });
  it('drops charges outside the active period', () => {
    const ended = expense({ activeFrom: '2026-09-06', activeTo: '2026-10-31' });
    expect(on(ended, '2026-09-01', '2026-12-31')).toEqual(['2026-10-05']);
  });
});
