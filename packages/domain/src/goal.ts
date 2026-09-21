import type { Account } from './account.js';
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
