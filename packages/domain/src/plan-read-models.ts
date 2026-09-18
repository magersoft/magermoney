import { isActiveOn, isActiveWithin } from './active-period.js';
import type { Budget } from './budget.js';
import { addDays, lastOfMonth, toIso, type YearMonth } from './calendar.js';
import type { Currency } from './currency.js';
import { monthlyAmount, occurrencesBetween, type Expense } from './expense.js';
import type { Inflow } from './inflow.js';
import { netMonthly, payoutsBetween, type IncomeSource } from './income-source.js';
import { Money } from './money.js';
import type { IsoDate } from './rate.js';
import type { RateTable } from './rate-table.js';

/** Points at the thing whose currency has no rate, so the screen can name it instead of dropping it. */
export interface PlanItemRef {
  kind: 'source' | 'expense' | 'budget' | 'inflow';
  id: string;
  name: string;
}

/** Adds up converted amounts and remembers what could not be converted. */
class Tally {
  total: Money;
  constructor(
    private readonly table: RateTable,
    private readonly display: Currency,
    private readonly unconvertible: PlanItemRef[],
  ) {
    this.total = Money.zero(display);
  }
  /** The converted amount, or null when there is no rate (the ref is then listed once). */
  add(money: Money, ref: PlanItemRef): Money | null {
    const converted = this.table.convert(money, this.display.code);
    if (converted.isErr()) {
      if (!this.unconvertible.some((u) => u.kind === ref.kind && u.id === ref.id))
        this.unconvertible.push(ref);
      return null;
    }
    this.total = this.total.add(converted.value)._unsafeUnwrap();
    return converted.value;
  }
}

export interface MonthPlan {
  netIncome: Money;
  plannedOutgo: Money;
  essential: Money;
  /** netIncome − plannedOutgo; negative when the plan spends more than it earns. */
  remainder: Money;
  unconvertible: PlanItemRef[];
}

/** The month as planned today: only what is active today counts. All amounts in the display currency. */
export function monthPlan(input: {
  sources: readonly IncomeSource[];
  expenses: readonly Expense[];
  budgets: readonly Budget[];
  table: RateTable;
  display: Currency;
  today: IsoDate;
}): MonthPlan {
  const { table, display, today } = input;
  const unconvertible: PlanItemRef[] = [];
  const income = new Tally(table, display, unconvertible);
  const outgo = new Tally(table, display, unconvertible);
  const essential = new Tally(table, display, unconvertible);
  for (const s of input.sources)
    if (isActiveOn(s, today)) income.add(netMonthly(s), { kind: 'source', id: s.id, name: s.name });
  for (const e of input.expenses) {
    if (!isActiveOn(e, today)) continue;
    const ref: PlanItemRef = { kind: 'expense', id: e.id, name: e.name };
    outgo.add(monthlyAmount(e), ref);
    if (e.isEssential) essential.add(monthlyAmount(e), ref);
  }
  for (const b of input.budgets)
    if (isActiveOn(b, today)) outgo.add(b.monthlyLimit, { kind: 'budget', id: b.id, name: b.name });
  return {
    netIncome: income.total,
    plannedOutgo: outgo.total,
    essential: essential.total,
    remainder: income.total.subtract(outgo.total)._unsafeUnwrap(),
    unconvertible,
  };
}

export interface UpcomingEvent {
  date: IsoDate;
  kind: 'payout' | 'expense';
  refId: string;
  name: string;
  /** In its own currency; the screen converts for display. */
  amount: Money;
}

/**
 * Expected payouts and expense charges for `days` calendar days starting
 * today (today included). Sorted by date, payouts before expenses on the same
 * day, then by name.
 */
export function upcomingEvents(input: {
  sources: readonly IncomeSource[];
  expenses: readonly Expense[];
  today: IsoDate;
  days?: number;
}): UpcomingEvent[] {
  const { today, days = 30 } = input;
  const to = addDays(today, days - 1);
  const events: UpcomingEvent[] = [];
  for (const s of input.sources)
    for (const p of payoutsBetween(s, today, to))
      events.push({
        date: p.date,
        kind: 'payout',
        refId: s.id,
        name: s.name,
        amount: p.amount,
      });
  for (const e of input.expenses)
    for (const o of occurrencesBetween(e, today, to))
      events.push({
        date: o.date,
        kind: 'expense',
        refId: e.id,
        name: e.name,
        amount: o.amount,
      });
  const kindOrder = { payout: 0, expense: 1 } as const;
  return events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      kindOrder[a.kind] - kindOrder[b.kind] ||
      a.name.localeCompare(b.name),
  );
}

export interface InflowsVsPlanRow {
  sourceId: string;
  name: string;
  /** Both in the display currency. */
  expected: Money;
  received: Money;
}
export interface InflowsVsPlan {
  rows: InflowsVsPlanRow[];
  totalExpected: Money;
  totalReceived: Money;
  unconvertible: PlanItemRef[];
}

/**
 * What each source was expected to bring in a month against what actually
 * came. A source gets a row when it is active on any day of the month or
 * received money in it — an ended source that still paid is not hidden.
 * `received` sums the Inflows' own amounts converted with the given table
 * (today's rates; historical conversion is phase 5 analytics). Inflows whose
 * source is not in `sources` are ignored, so callers pass every source, ended
 * ones included.
 */
export function inflowsVsPlan(input: {
  sources: readonly IncomeSource[];
  inflows: readonly Inflow[];
  month: YearMonth;
  table: RateTable;
  display: Currency;
}): InflowsVsPlan {
  const { table, display, month } = input;
  const first = toIso(month.year, month.month, 1);
  const last = lastOfMonth(first);
  const unconvertible: PlanItemRef[] = [];
  const totalExpected = new Tally(table, display, unconvertible);
  const totalReceived = new Tally(table, display, unconvertible);
  const inMonth = input.inflows.filter((i) => i.receivedOn >= first && i.receivedOn <= last);
  const rows: InflowsVsPlanRow[] = [];
  for (const s of input.sources) {
    const mine = inMonth.filter((i) => i.incomeSourceId === s.id);
    const active = isActiveWithin(s, first, last);
    if (!active && mine.length === 0) continue;
    const expected = active
      ? totalExpected.add(netMonthly(s), {
          kind: 'source',
          id: s.id,
          name: s.name,
        })
      : null;
    let received = Money.zero(display);
    for (const i of mine) {
      const converted = totalReceived.add(i.amount, {
        kind: 'inflow',
        id: i.id,
        name: s.name,
      });
      if (converted) received = received.add(converted)._unsafeUnwrap();
    }
    rows.push({
      sourceId: s.id,
      name: s.name,
      expected: expected ?? Money.zero(display),
      received,
    });
  }
  return {
    rows,
    totalExpected: totalExpected.total,
    totalReceived: totalReceived.total,
    unconvertible,
  };
}
