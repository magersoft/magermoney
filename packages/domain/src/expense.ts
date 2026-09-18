import { isActiveOn, type ActivePeriod } from './active-period.js';
import { clampDay, monthsTouching } from './calendar.js';
import { Money } from './money.js';
import type { IsoDate } from './rate.js';

export const EXPENSE_PERIODS = ['monthly', 'yearly'] as const;
export type ExpensePeriod = (typeof EXPENSE_PERIODS)[number];

/** A fixed recurring obligation. `amount` is what is charged each period: per month, or per year. */
export interface Expense extends ActivePeriod {
  id: string;
  categoryId: string;
  name: string;
  amount: Money;
  period: ExpensePeriod;
  /** Day of the month it is charged on; null = the date is not known, so it never shows on the calendar. */
  billingDay: number | null;
  /** 1..12, yearly expenses only. */
  billingMonth: number | null;
  isEssential: boolean;
}

export interface Occurrence {
  date: IsoDate;
  amount: Money;
}

/** What the expense costs per month: a yearly one is spread over twelve months, rounded to the currency scale. */
export function monthlyAmount(e: Pick<Expense, 'amount' | 'period'>): Money {
  return e.period === 'monthly'
    ? e.amount
    : Money.of(e.amount.amount.div(12), e.amount.currency).round();
}

/**
 * The charges dated inside `[from, to]`, each for the full `amount`. Monthly:
 * every month on `billingDay`; yearly: once a year on `billingMonth`/`billingDay`.
 * A billing day beyond the month's length falls on its last day. Without a
 * billing day (or, for a yearly expense, a billing month) there is nothing to
 * put on the calendar. Dates outside the active period are dropped.
 */
export function occurrencesBetween(e: Expense, from: IsoDate, to: IsoDate): Occurrence[] {
  const { billingDay, billingMonth } = e;
  if (billingDay === null) return [];
  if (e.period === 'yearly' && billingMonth === null) return [];
  const occurrences: Occurrence[] = [];
  for (const { year, month } of monthsTouching(from, to)) {
    if (e.period === 'yearly' && month !== billingMonth) continue;
    const date = clampDay(year, month, billingDay);
    if (date < from || date > to || !isActiveOn(e, date)) continue;
    occurrences.push({ date, amount: e.amount });
  }
  return occurrences;
}
