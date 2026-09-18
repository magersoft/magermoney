import Decimal from 'decimal.js';
import { isActiveOn, type ActivePeriod } from './active-period.js';
import { addDays, clampDay, daysBetween, monthsTouching } from './calendar.js';
import { Money } from './money.js';
import type { IsoDate } from './rate.js';

/** A recurring origin of income. `grossAmount` is what it pays per month before tax and commission. */
export interface IncomeSource extends ActivePeriod {
  id: string;
  name: string;
  grossAmount: Money;
  /** 0 ≤ rate < 1 */
  taxRate: Decimal;
  /** 0 ≤ rate < 1, taken from what is left after tax. */
  commissionRate: Decimal;
  /** Days of the month, 1..31. Empty = irregular: planned per month, never on the calendar. */
  payDays: number[];
  isPrimary: boolean;
  defaultAccountId: string | null;
}

export interface Payout {
  date: IsoDate;
  amount: Money;
}

/** How far ahead `nextPayday` looks: two full months always contain the next pay day of a monthly schedule. */
export const PAYDAY_LOOKAHEAD_DAYS = 62;

/** gross × (1 − tax) × (1 − commission), rounded to the currency scale. Derived, never stored. */
export function netMonthly(
  s: Pick<IncomeSource, 'grossAmount' | 'taxRate' | 'commissionRate'>,
): Money {
  return s.grossAmount
    .multiply(new Decimal(1).minus(s.taxRate))
    .multiply(new Decimal(1).minus(s.commissionRate))
    .round();
}

/**
 * The expected payouts dated inside `[from, to]`. Each month pays `netMonthly`
 * in equal parts rounded down, one per pay day; the month's last part absorbs the
 * remainder, so a full month always sums to `netMonthly` exactly. A pay day
 * beyond the month's length falls on its last day, and two pay days that land
 * on the same date stay two payouts. Dates outside the active period are dropped.
 */
export function payoutsBetween(s: IncomeSource, from: IsoDate, to: IsoDate): Payout[] {
  if (s.payDays.length === 0) return [];
  const days = [...s.payDays].sort((a, b) => a - b);
  const net = netMonthly(s);
  const part = Money.of(
    net.amount.div(days.length).toDecimalPlaces(net.currency.scale, Decimal.ROUND_DOWN),
    net.currency,
  );
  const lastPart = Money.of(net.amount.minus(part.amount.times(days.length - 1)), net.currency);
  const payouts: Payout[] = [];
  for (const { year, month } of monthsTouching(from, to)) {
    days.forEach((day, i) => {
      const date = clampDay(year, month, day);
      if (date < from || date > to || !isActiveOn(s, date)) return;
      payouts.push({ date, amount: i === days.length - 1 ? lastPart : part });
    });
  }
  return payouts;
}

/** The primary source's first payout dated today or later; null without a primary source, pay days or an active period ahead. */
export function nextPayday(sources: readonly IncomeSource[], today: IsoDate): IsoDate | null {
  const primary = sources.find((s) => s.isPrimary);
  if (!primary) return null;
  const [next] = payoutsBetween(primary, today, addDays(today, PAYDAY_LOOKAHEAD_DAYS));
  return next ? next.date : null;
}

/** Whole days until the primary source pays next; 0 when payday is today. */
export function daysToPayday(sources: readonly IncomeSource[], today: IsoDate): number | null {
  const next = nextPayday(sources, today);
  return next === null ? null : daysBetween(today, next);
}

/** What may be spent per day until payday. Payday today still counts as one day, so nothing divides by zero. */
export function perDay(available: Money, days: number): Money {
  return Money.of(available.amount.div(Math.max(days, 1)), available.currency).round();
}
