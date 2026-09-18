import type { ExpenseCategoryDto, ExpenseDto } from '@magermoney/contracts';
import {
  Money,
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
  ended: Expense[];
  unconvertible: Expense[];
}

const UNKNOWN: ExpenseCategoryDto = {
  id: '',
  name: '—',
  icon: null,
  sortOrder: Number.MAX_SAFE_INTEGER,
};

/** Pure: the Expenses segment from DTOs, a rate table and a display currency. Undefined while an input is missing. */
export function groupExpenses(
  dtos: readonly ExpenseDto[],
  categories: readonly ExpenseCategoryDto[],
  table: RateTable | undefined,
  registry: CurrencyRegistry,
  display: string,
  today: IsoDate,
): ExpenseGroups | undefined {
  const currency = registry.get(display);
  if (!table || currency.isErr()) return undefined;
  const zero = Money.zero(currency.value);
  const all = dtos.map((d) => toExpense(d, registry));
  /* An expense that starts next month is already part of the plan — the same
   * reading the Income segment gives a source that has not begun paying yet.
   * "Ended" is the only thing that takes a row out of the list. */
  const current = all.filter((e) => e.activeTo === null || e.activeTo >= today);
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
    ended: all.filter((e) => e.activeTo !== null && e.activeTo < today),
    unconvertible,
  };
}
