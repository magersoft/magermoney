import { describe, expect, it } from 'vitest';
import {
  CurrencyRegistry,
  Decimal,
  Money,
  daysToPayday,
  netMonthly,
  nextPayday,
  payoutsBetween,
  perDay,
  type IncomeSource,
} from '../src/index.js';

const reg = CurrencyRegistry.sample();
const c = (code: string) => reg.get(code)._unsafeUnwrap();

const source = (over: Partial<IncomeSource> = {}): IncomeSource => ({
  id: 's1',
  name: 'Salary',
  grossAmount: Money.of('412345', c('RUB')),
  taxRate: new Decimal('0.15'),
  commissionRate: new Decimal('0.10'),
  payDays: [10, 25],
  isPrimary: true,
  defaultAccountId: null,
  activeFrom: '2025-01-01',
  activeTo: null,
  ...over,
});
const dates = (s: IncomeSource, from: string, to: string) =>
  payoutsBetween(s, from, to).map((p) => `${p.date} ${p.amount.toString()}`);

describe('netMonthly', () => {
  it('takes tax first and commission from the rest, rounded to the currency scale', () => {
    // 412345 × 0.85 × 0.90 = 315443.925 → 315443.93
    expect(netMonthly(source()).toString()).toBe('315443.93');
  });
  it('equals gross when both rates are zero', () => {
    const s = source({
      grossAmount: Money.of('4200', c('USD')),
      taxRate: new Decimal(0),
      commissionRate: new Decimal(0),
    });
    expect(netMonthly(s).toString()).toBe('4200');
  });
});

describe('payoutsBetween', () => {
  it('splits the month evenly and lets the last payout absorb the rounding remainder', () => {
    const s = source({
      grossAmount: Money.of('100', c('USD')),
      payDays: [5, 15, 25],
    });
    // net 76.50 → 25.50 each
    expect(dates(s, '2026-09-01', '2026-09-30')).toEqual([
      '2026-09-05 25.5',
      '2026-09-15 25.5',
      '2026-09-25 25.5',
    ]);
    const odd = source({
      grossAmount: Money.of('100', c('USD')),
      taxRate: new Decimal(0),
      commissionRate: new Decimal(0),
      payDays: [25, 5, 15],
    });
    // 33.33 + 33.33 + 33.34, and unsorted pay days are put in order
    expect(dates(odd, '2026-09-01', '2026-09-30')).toEqual([
      '2026-09-05 33.33',
      '2026-09-15 33.33',
      '2026-09-25 33.34',
    ]);
  });
  it('moves pay day 31 to the last day of February', () => {
    const s = source({ payDays: [31] });
    expect(payoutsBetween(s, '2026-02-01', '2026-03-31').map((p) => p.date)).toEqual([
      '2026-02-28',
      '2026-03-31',
    ]);
  });
  it('keeps two payouts when two pay days clamp onto the same date', () => {
    const s = source({ payDays: [30, 31] });
    expect(payoutsBetween(s, '2026-02-01', '2026-02-28').map((p) => p.date)).toEqual([
      '2026-02-28',
      '2026-02-28',
    ]);
  });
  it('keeps only dates inside the range', () => {
    expect(payoutsBetween(source(), '2026-09-11', '2026-10-10').map((p) => p.date)).toEqual([
      '2026-09-25',
      '2026-10-10',
    ]);
  });
  it('drops payouts outside the active period: a source ending mid-month pays only its first half', () => {
    const s = source({ activeFrom: '2026-09-11', activeTo: '2026-10-15' });
    expect(payoutsBetween(s, '2026-09-01', '2026-10-31').map((p) => p.date)).toEqual([
      '2026-09-25',
      '2026-10-10',
    ]);
  });
  it('is empty for an irregular source', () => {
    expect(payoutsBetween(source({ payDays: [] }), '2026-09-01', '2026-09-30')).toEqual([]);
  });
});

describe('nextPayday and daysToPayday', () => {
  const other = source({ id: 's2', isPrimary: false, payDays: [1] });
  it('counts to the primary source only', () => {
    expect(nextPayday([other, source()], '2026-09-17')).toBe('2026-09-25');
    expect(daysToPayday([other, source()], '2026-09-17')).toBe(8);
  });
  it('is zero when payday is today', () => {
    expect(daysToPayday([source()], '2026-09-25')).toBe(0);
  });
  it('rolls into the next month', () => {
    expect(nextPayday([source()], '2026-09-26')).toBe('2026-10-10');
  });
  it('is null without a primary source, without pay days, or once the source has ended', () => {
    expect(nextPayday([other], '2026-09-17')).toBeNull();
    expect(daysToPayday([], '2026-09-17')).toBeNull();
    expect(nextPayday([source({ payDays: [] })], '2026-09-17')).toBeNull();
    expect(nextPayday([source({ activeTo: '2026-09-20' })], '2026-09-21')).toBeNull();
  });
});

describe('perDay', () => {
  it('divides what is available by the days left and rounds', () => {
    expect(perDay(Money.of('1000', c('EUR')), 8).toString()).toBe('125');
    expect(perDay(Money.of('100', c('EUR')), 3).toString()).toBe('33.33');
  });
  it('treats payday today as one day', () => {
    expect(perDay(Money.of('100', c('EUR')), 0).toString()).toBe('100');
  });
});
