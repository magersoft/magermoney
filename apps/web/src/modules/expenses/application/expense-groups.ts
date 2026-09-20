import type { ExpenseCategoryDto, ExpenseDto } from '@magermoney/contracts';
import {
  Money,
  firstOfMonth,
  isActiveWithin,
  lastOfMonth,
  monthlyAmount,
  type CurrencyRegistry,
  type Expense,
  type IsoDate,
  type RateTable,
} from '@magermoney/domain';
import { toExpense } from '../domain/mappers';

export interface ExpenseRowModel {
  expense: Expense;
  /** Monthly-normalised, in the expense's own currency. */
  monthly: Money;
}
export interface ExpenseGroup {
  category: ExpenseCategoryDto;
  rows: ExpenseRowModel[];
  /** Monthly total of the group in the display currency. */
  total: Money;
}
export interface ExpenseGroups {
  groups: ExpenseGroup[];
  planned: Money;
  essential: Money;
  /** Over before the month being read began. */
  ended: Expense[];
  /** Not started by the end of it: part of the plan, just not of this month. */
  upcoming: Expense[];
  unconvertible: Expense[];
}

const UNKNOWN: ExpenseCategoryDto = {
  id: '',
  name: '—',
  icon: null,
  sortOrder: Number.MAX_SAFE_INTEGER,
};

/**
 * Pure: the Expenses segment from DTOs, a rate table and a display currency,
 * for one month. Undefined while an input is missing.
 *
 * The month is what the screen is reading, not what today is: the segment pages
 * back and forward, and a month shows the obligations that were live in it.
 * What falls outside is not dropped — an expense that is over and one that has
 * not started are two different lists the screen can offer, so paging never
 * hides something the plan still holds.
 */
export function groupExpenses(
  dtos: readonly ExpenseDto[],
  categories: readonly ExpenseCategoryDto[],
  table: RateTable | undefined,
  registry: CurrencyRegistry,
  display: string,
  today: IsoDate,
  month: IsoDate = today,
): ExpenseGroups | undefined {
  const currency = registry.get(display);
  if (!table || currency.isErr()) return undefined;
  const zero = Money.zero(currency.value);
  const all = dtos.map((d) => toExpense(d, registry));
  const from = firstOfMonth(month);
  const to = lastOfMonth(month);
  const current = all.filter((e) => isActiveWithin(e, from, to));
  const byCategory = new Map<string, ExpenseGroup>();
  let planned = zero;
  let essential = zero;
  const unconvertible: Expense[] = [];

  for (const expense of [...current].sort((a, b) => a.name.localeCompare(b.name))) {
    const category = categories.find((c) => c.id === expense.categoryId) ?? UNKNOWN;
    const group = byCategory.get(category.id) ?? { category, rows: [], total: zero };
    const monthly = monthlyAmount(expense);
    group.rows.push({ expense, monthly });
    const converted = table.convert(monthly, display);
    if (converted.isErr()) unconvertible.push(expense);
    else {
      group.total = group.total.add(converted.value)._unsafeUnwrap();
      planned = planned.add(converted.value)._unsafeUnwrap();
      if (expense.isEssential) essential = essential.add(converted.value)._unsafeUnwrap();
    }
    byCategory.set(category.id, group);
  }

  return {
    groups: [...byCategory.values()].sort(
      (a, b) =>
        a.category.sortOrder - b.category.sortOrder ||
        a.category.name.localeCompare(b.category.name),
    ),
    planned,
    essential,
    ended: all.filter((e) => e.activeTo !== null && e.activeTo < from),
    upcoming: all.filter((e) => e.activeFrom > to),
    unconvertible,
  };
}
