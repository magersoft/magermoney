import { describe, expect, it } from 'vitest';
import {
  CurrencyRegistry,
  Decimal,
  Money,
  RateTable,
  inflowsVsPlan,
  monthPlan,
  upcomingEvents,
  type Budget,
  type Expense,
  type IncomeSource,
  type Inflow,
  type Rate,
} from '../src/index.js';

const reg = CurrencyRegistry.sample();
const c = (code: string) => reg.get(code)._unsafeUnwrap();
const rate = (base: string, value: string): Rate => ({
  base,
  quote: 'USD',
  value: new Decimal(value),
  date: '2026-09-17',
  source: 'api',
});
// 1 EUR = 1.25 USD, 1 RUB = 0.0125 USD; BTC has no rate.
const table = new RateTable('2026-09-17', [rate('EUR', '1.25'), rate('RUB', '0.0125')], reg);
const today = '2026-09-17';

const source = (over: Partial<IncomeSource> = {}): IncomeSource => ({
  id: 's1',
  name: 'Agency',
  grossAmount: Money.of('5000', c('USD')),
  taxRate: new Decimal(0),
  commissionRate: new Decimal(0),
  payDays: [4],
  isPrimary: true,
  defaultAccountId: null,
  activeFrom: '2025-01-01',
  activeTo: null,
  ...over,
});
const expense = (over: Partial<Expense> = {}): Expense => ({
  id: 'e1',
  categoryId: 'c1',
  name: 'Rent',
  amount: Money.of('1600', c('EUR')),
  period: 'monthly',
  billingDay: 5,
  billingMonth: null,
  isEssential: true,
  activeFrom: '2025-01-01',
  activeTo: null,
  ...over,
});
const budget = (over: Partial<Budget> = {}): Budget => ({
  id: 'b1',
  name: 'Groceries',
  icon: null,
  monthlyLimit: Money.of('800', c('EUR')),
  activeFrom: '2025-01-01',
  activeTo: null,
  ...over,
});
const inflow = (over: Partial<Inflow> = {}): Inflow => ({
  id: 'i1',
  incomeSourceId: 's1',
  amount: Money.of('5000', c('USD')),
  receivedOn: '2026-09-04',
  realisedRateToUsd: null,
  accountId: null,
  creditedAmount: null,
  note: null,
  ...over,
});

describe('monthPlan', () => {
  it('puts net income, planned outgo, the essential part and the remainder in the display currency', () => {
    const salary = source({
      id: 's2',
      name: 'Salary',
      grossAmount: Money.of('400000', c('RUB')),
      taxRate: new Decimal('0.15'),
      commissionRate: new Decimal('0.10'),
      isPrimary: false,
    });
    const plan = monthPlan({
      sources: [source(), salary],
      expenses: [
        expense(),
        expense({
          id: 'e2',
          name: 'Flight tracker',
          amount: Money.of('48', c('USD')),
          period: 'yearly',
          isEssential: false,
        }),
      ],
      budgets: [budget()],
      table,
      display: c('USD'),
      today,
    });
    // 5000 + 306000 RUB × 0.0125 = 8825
    expect(plan.netIncome.toString()).toBe('8825');
    // 1600 EUR × 1.25 + 48 ÷ 12 + 800 EUR × 1.25 = 2000 + 4 + 1000
    expect(plan.plannedOutgo.toString()).toBe('3004');
    expect(plan.essential.toString()).toBe('2000');
    expect(plan.remainder.toString()).toBe('5821');
    expect(plan.unconvertible).toEqual([]);
  });
  it('counts only what is active today and lets the remainder go negative', () => {
    const plan = monthPlan({
      sources: [source({ activeTo: '2026-09-16' })],
      expenses: [expense(), expense({ id: 'e2', activeFrom: '2026-10-01' })],
      budgets: [budget({ activeTo: '2026-08-31' })],
      table,
      display: c('EUR'),
      today,
    });
    expect(plan.netIncome.toString()).toBe('0');
    expect(plan.plannedOutgo.toString()).toBe('1600');
    expect(plan.remainder.toString()).toBe('-1600');
  });
  it('lists what it cannot convert once, even when it counts twice', () => {
    const plan = monthPlan({
      sources: [
        source({
          id: 'sb',
          name: 'Mining',
          grossAmount: Money.of('1', c('BTC')),
        }),
      ],
      expenses: [expense({ id: 'eb', name: 'Node', amount: Money.of('0.01', c('BTC')) })],
      budgets: [
        budget({
          id: 'bb',
          name: 'Sats',
          monthlyLimit: Money.of('0.02', c('BTC')),
        }),
      ],
      table,
      display: c('USD'),
      today,
    });
    expect(plan.netIncome.isZero()).toBe(true);
    expect(plan.plannedOutgo.isZero()).toBe(true);
    expect(plan.unconvertible).toEqual([
      { kind: 'source', id: 'sb', name: 'Mining' },
      { kind: 'expense', id: 'eb', name: 'Node' },
      { kind: 'budget', id: 'bb', name: 'Sats' },
    ]);
  });
});

describe('upcomingEvents', () => {
  it('lists payouts and charges for thirty days from today, payouts first on a shared day', () => {
    const events = upcomingEvents({
      sources: [source({ payDays: [5, 20] }), source({ id: 's3', name: 'Dividends', payDays: [] })],
      expenses: [
        expense(),
        expense({
          id: 'e2',
          name: 'Pool',
          billingDay: 20,
          amount: Money.of('28', c('EUR')),
        }),
        expense({
          id: 'e3',
          name: 'Cloud',
          billingDay: 20,
          amount: Money.of('16', c('EUR')),
        }),
        expense({ id: 'e4', name: 'No date', billingDay: null }),
      ],
      today,
    });
    expect(events.map((e) => `${e.date} ${e.kind} ${e.name} ${e.amount.toString()}`)).toEqual([
      '2026-09-20 payout Agency 2500',
      '2026-09-20 expense Cloud 16',
      '2026-09-20 expense Pool 28',
      '2026-10-05 payout Agency 2500',
      '2026-10-05 expense Rent 1600',
    ]);
    expect(events[0]?.refId).toBe('s1');
  });
  it('counts today as the first day and stops after `days` days', () => {
    const events = upcomingEvents({
      sources: [source({ payDays: [17, 18] })],
      expenses: [],
      today,
      days: 1,
    });
    expect(events.map((e) => e.date)).toEqual(['2026-09-17']);
    // Thirty days from 17 Sep end on 16 Oct: the 17 Oct payout is out.
    const month = upcomingEvents({
      sources: [source({ payDays: [17] })],
      expenses: [],
      today,
    });
    expect(month.map((e) => e.date)).toEqual(['2026-09-17']);
  });
});

describe('inflowsVsPlan', () => {
  const september = { year: 2026, month: 9 };
  it('sets what came against what was expected, per source, in the display currency', () => {
    const salary = source({
      id: 's2',
      name: 'Salary',
      grossAmount: Money.of('400000', c('RUB')),
      isPrimary: false,
    });
    const r = inflowsVsPlan({
      sources: [source(), salary],
      inflows: [
        inflow(),
        inflow({
          id: 'i2',
          incomeSourceId: 's2',
          amount: Money.of('200000', c('RUB')),
          receivedOn: '2026-09-10',
        }),
        inflow({ id: 'i3', receivedOn: '2026-08-31' }),
        inflow({ id: 'i4', receivedOn: '2026-10-01' }),
        inflow({ id: 'i5', incomeSourceId: 'gone' }),
      ],
      month: september,
      table,
      display: c('USD'),
    });
    expect(
      r.rows.map((x) => `${x.name} ${x.received.toString()}/${x.expected.toString()}`),
    ).toEqual(['Agency 5000/5000', 'Salary 2500/5000']);
    expect(r.rows[0]?.sourceId).toBe('s1');
    expect(r.totalExpected.toString()).toBe('10000');
    expect(r.totalReceived.toString()).toBe('7500');
    expect(r.unconvertible).toEqual([]);
  });
  it('keeps an ended source that still received money and hides an ended one that did not', () => {
    const gig = source({
      id: 'sb',
      name: 'Gig',
      activeFrom: '2025-06-01',
      activeTo: '2025-06-30',
    });
    const quiet = source({
      id: 'sq',
      name: 'Quiet',
      activeFrom: '2025-01-01',
      activeTo: '2025-12-31',
    });
    const starting = source({
      id: 'sn',
      name: 'New',
      activeFrom: '2026-09-30',
    });
    const r = inflowsVsPlan({
      sources: [gig, quiet, starting],
      inflows: [inflow({ incomeSourceId: 'sb', amount: Money.of('100', c('EUR')) })],
      month: september,
      table,
      display: c('USD'),
    });
    expect(
      r.rows.map((x) => `${x.name} ${x.received.toString()}/${x.expected.toString()}`),
    ).toEqual(['Gig 125/0', 'New 0/5000']);
  });
  it('lists sources and inflows it cannot convert instead of dropping them silently', () => {
    const mining = source({
      id: 'sm',
      name: 'Mining',
      grossAmount: Money.of('1', c('BTC')),
    });
    const r = inflowsVsPlan({
      sources: [mining],
      inflows: [
        inflow({
          id: 'ib',
          incomeSourceId: 'sm',
          amount: Money.of('0.5', c('BTC')),
        }),
      ],
      month: september,
      table,
      display: c('USD'),
    });
    expect(r.rows).toEqual([
      {
        sourceId: 'sm',
        name: 'Mining',
        expected: Money.zero(c('USD')),
        received: Money.zero(c('USD')),
      },
    ]);
    expect(r.unconvertible).toEqual([
      { kind: 'source', id: 'sm', name: 'Mining' },
      { kind: 'inflow', id: 'ib', name: 'Mining' },
    ]);
  });
});
