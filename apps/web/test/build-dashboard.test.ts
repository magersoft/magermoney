import { describe, expect, it } from 'vitest';
import {
  CurrencyRegistry,
  Decimal,
  Money,
  RateTable,
  type Budget,
  type Expense,
  type IncomeSource,
  type Inflow,
} from '@magermoney/domain';
import { buildDashboard } from '../src/modules/dashboard/application/build-dashboard.js';

const reg = CurrencyRegistry.default();
const USD = reg.get('USD')._unsafeUnwrap();
const EUR = reg.get('EUR')._unsafeUnwrap();
const table = new RateTable(
  '2026-09-17',
  [{ base: 'EUR', quote: 'USD', value: new Decimal('1.2'), date: '2026-09-17', source: 'api' }],
  reg,
);
const source = (over: Partial<IncomeSource> = {}): IncomeSource => ({
  id: 's1',
  name: 'Job',
  grossAmount: Money.of('3000', USD),
  taxRate: new Decimal(0),
  commissionRate: new Decimal(0),
  payDays: [10, 25],
  isPrimary: true,
  defaultAccountId: null,
  activeFrom: '2026-01-01',
  activeTo: null,
  ...over,
});
const expense = (over: Partial<Expense> = {}): Expense => ({
  id: 'e1',
  categoryId: 'c',
  name: 'Rent',
  amount: Money.of('1000', EUR),
  period: 'monthly',
  billingDay: 5,
  billingMonth: null,
  isEssential: true,
  activeFrom: '2026-01-01',
  activeTo: null,
  ...over,
});
const budget: Budget = {
  id: 'b1',
  name: 'Groceries',
  icon: null,
  monthlyLimit: Money.of('300', USD),
  activeFrom: '2026-01-01',
  activeTo: null,
};
const inflow: Inflow = {
  id: 'i1',
  incomeSourceId: 's1',
  amount: Money.of('1500', USD),
  receivedOn: '2026-09-10',
  realisedRateToUsd: null,
  accountId: null,
  creditedAmount: null,
  note: null,
};
const capital = {
  total: Money.of('5000', USD),
  availableUntilPayday: Money.of('800', USD),
  unconvertible: [],
  groups: [],
  archived: [],
};
const input = (over: object = {}) => ({
  capital,
  sources: [source()],
  expenses: [
    expense(),
    expense({
      id: 'e2',
      name: 'Gym',
      amount: Money.of('30', USD),
      billingDay: null,
      isEssential: false,
    }),
  ],
  budgets: [budget],
  inflows: [inflow],
  table,
  registry: reg,
  display: 'USD',
  today: '2026-09-17',
  ...over,
});

describe('buildDashboard', () => {
  it('counts the days to the primary source payday and what that leaves per day', () => {
    const d = buildDashboard(input())!;
    expect(d.payday.date).toBe('2026-09-25');
    expect(d.payday.days).toBe(8);
    expect(d.payday.perDay?.toString()).toBe('100');
  });

  it('has no payday without a primary source with pay days', () => {
    const d = buildDashboard(input({ sources: [source({ payDays: [] })] }))!;
    expect(d.payday).toEqual({ date: null, days: null, perDay: null });
  });

  it('plans the month in the display currency', () => {
    const d = buildDashboard(input())!;
    expect(d.plan.netIncome.round().toString()).toBe('3000');
    expect(d.plan.plannedOutgo.round().toString()).toBe('1530');
    expect(d.plan.essential.round().toString()).toBe('1200');
    expect(d.plan.remainder.round().toString()).toBe('1470');
  });

  it('sets received against expected for the current month', () => {
    const row = buildDashboard(input())!.inflows.rows[0]!;
    expect(row.received.round().toString()).toBe('1500');
    expect(row.expected.round().toString()).toBe('3000');
  });

  it('groups upcoming events by date and counts expenses that have no date', () => {
    const d = buildDashboard(input())!;
    expect(d.upcoming[0]?.date).toBe('2026-09-25');
    expect(d.upcoming[0]?.events[0]?.kind).toBe('payout');
    expect(
      d.upcoming.some((g) => g.date === '2026-10-05' && g.events.some((e) => e.name === 'Rent')),
    ).toBe(true);
    expect([...d.upcoming.map((g) => g.date)]).toEqual([...d.upcoming.map((g) => g.date)].sort());
    expect(d.undatedExpenses).toBe(1);
  });

  it("names a source the day's rates cannot price, so its empty row is explained", () => {
    const RUB = reg.get('RUB')._unsafeUnwrap();
    const d = buildDashboard(
      input({
        sources: [
          source(),
          source({
            id: 's2',
            name: 'Lessons',
            grossAmount: Money.of('50000', RUB),
            isPrimary: false,
          }),
        ],
      }),
    )!;
    expect(d.inflows.unconvertible.map((r) => r.name)).toEqual(['Lessons']);
    expect(d.inflows.rows.find((r) => r.sourceId === 's2')?.expected.toString()).toBe('0');
  });

  it('says what is missing, so each block can show its empty state', () => {
    const d = buildDashboard(input({ sources: [], expenses: [], budgets: [], inflows: [] }))!;
    expect(d.has).toEqual({ sources: false, outgo: false });
    expect(d.upcoming).toEqual([]);
  });

  it('is undefined until capital, rates and the display currency exist', () => {
    expect(buildDashboard(input({ capital: undefined }))).toBeUndefined();
    expect(buildDashboard(input({ table: undefined }))).toBeUndefined();
    expect(buildDashboard(input({ display: 'XXX' }))).toBeUndefined();
  });
});
