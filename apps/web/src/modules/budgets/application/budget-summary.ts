import type { BudgetDto } from '@magermoney/contracts';
import {
  Money,
  type Budget,
  type CurrencyRegistry,
  type IsoDate,
  type RateTable,
} from '@magermoney/domain';
import { toBudget } from '../domain/mappers';

export interface BudgetSummary {
  active: Budget[];
  ended: Budget[];
  /** Sum of active monthly limits in the display currency. */
  total: Money;
  unconvertible: Budget[];
}

/** Pure: the Budgets segment. Undefined while rates or the display currency are missing. */
export function summariseBudgets(
  dtos: readonly BudgetDto[],
  table: RateTable | undefined,
  registry: CurrencyRegistry,
  display: string,
  today: IsoDate,
): BudgetSummary | undefined {
  const currency = registry.get(display);
  if (!table || currency.isErr()) return undefined;
  const all = dtos.map((d) => toBudget(d, registry));
  /* A budget that starts next month is already part of the plan — the same
   * reading the Income and Expenses segments give something that has not begun
   * yet. "Ended" is the only thing that takes a row out of the list. */
  const active = all
    .filter((b) => b.activeTo === null || b.activeTo >= today)
    .sort((a, b) => a.name.localeCompare(b.name));
  let total = Money.zero(currency.value);
  const unconvertible: Budget[] = [];
  for (const b of active) {
    const c = table.convert(b.monthlyLimit, display);
    if (c.isErr()) unconvertible.push(b);
    else total = total.add(c.value)._unsafeUnwrap();
  }
  return {
    active,
    ended: all.filter((b) => b.activeTo !== null && b.activeTo < today),
    total,
    unconvertible,
  };
}
