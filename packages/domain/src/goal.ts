import type { Account } from './account.js';
import { addDays, type YearMonth } from './calendar.js';
import { Money } from './money.js';
import type { IsoDate } from './rate.js';
import type { RateTable } from './rate-table.js';

export interface Goal {
  id: string;
  name: string;
  icon: string | null;
  /** The amount to reach, in the goal's own currency. */
  target: Money;
  targetDate: IsoDate | null;
  achievedAt: string | null;
  archivedAt: string | null;
  sortOrder: number;
}

export interface GoalProgress {
  funded: Money;
  /** Never negative: an overfunded goal needs nothing more. */
  remaining: Money;
  /** 0..1, clamped, for a progress bar. */
  ratio: number;
  /** Linked accounts today's rates cannot price. Listed, never counted as zero. */
  unconvertible: Account[];
}

/**
 * What a Goal holds: the balances of the Accounts linked to it, converted into
 * the Goal's currency. The conversion can fail for a currency with no rate
 * today — that Account is reported rather than silently dropped, exactly as
 * `totalCapital` reports it.
 */
export function goalProgress(
  goal: Goal,
  linked: readonly Account[],
  table: RateTable,
): GoalProgress {
  const currency = goal.target.currency;
  let funded = Money.zero(currency);
  const unconvertible: Account[] = [];
  for (const a of linked) {
    const converted = table.convert(a.balance, currency.code);
    if (converted.isErr()) {
      unconvertible.push(a);
      continue;
    }
    funded = funded.add(converted.value)._unsafeUnwrap();
  }
  const short = goal.target.amount.minus(funded.amount);
  const remaining = Money.of(short.isPositive() ? short : 0, currency);
  const ratio = goal.target.amount.isZero()
    ? 1
    : Math.min(1, funded.amount.div(goal.target.amount).toNumber());
  return { funded, remaining, ratio: Math.max(0, ratio), unconvertible };
}

/** One month's closing total across the linked Accounts, in the Goal's currency. */
export interface MonthlyBalance {
  month: YearMonth;
  total: Money;
}

export type GoalForecast =
  | { kind: 'date'; on: IsoDate; monthlyRate: Money }
  | { kind: 'none'; reason: 'not_enough_history' | 'not_advancing' | 'achieved' | 'too_far' };

/** The window the rate is measured over, and the least history that may be measured. */
export const FORECAST_WINDOW_MONTHS = 6;
export const FORECAST_MIN_MONTHS = 2;
/**
 * How far ahead a forecast is still worth printing. A rate that positive but
 * tiny against a large remainder answers with a year a person cannot plan
 * around — and beyond year 9999 it is not even an `IsoDate` any more, which is
 * how this case was found.
 */
export const FORECAST_HORIZON_YEARS = 50;

const DAYS_IN_MONTH = 30;
const HORIZON_DAYS = FORECAST_HORIZON_YEARS * 365;

/**
 * When the Goal is reached if the last months repeat themselves. The rate is
 * measured, not declared: the average monthly growth of the linked Accounts
 * across the last six closing totals.
 *
 * It answers with a reason rather than a date whenever the answer would be
 * invented — too little history to average, a balance going nowhere or
 * backwards, a Goal already reached, or a date past the horizon anyone plans
 * around. A screen can say any of those plainly; it cannot say "infinity".
 */
export function goalForecast(
  goal: Goal,
  progress: GoalProgress,
  history: readonly MonthlyBalance[],
  today: IsoDate,
): GoalForecast {
  if (progress.remaining.amount.isZero()) return { kind: 'none', reason: 'achieved' };
  const window = history.slice(-FORECAST_WINDOW_MONTHS);
  if (window.length < FORECAST_MIN_MONTHS) return { kind: 'none', reason: 'not_enough_history' };

  const first = window[0]!.total.amount;
  const last = window[window.length - 1]!.total.amount;
  const steps = window.length - 1;
  const rate = last.minus(first).div(steps);
  if (!rate.isPositive()) return { kind: 'none', reason: 'not_advancing' };

  const months = progress.remaining.amount.div(rate);
  const days = months.times(DAYS_IN_MONTH).ceil().toNumber();
  if (days > HORIZON_DAYS) return { kind: 'none', reason: 'too_far' };
  return {
    kind: 'date',
    on: addDays(today, days),
    monthlyRate: Money.of(rate, goal.target.currency),
  };
}
