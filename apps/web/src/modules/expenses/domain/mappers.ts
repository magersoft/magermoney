import type { ExpenseDto } from '@magermoney/contracts';
import { Money, type Currency, type CurrencyRegistry, type Expense } from '@magermoney/domain';

const fallback = (code: string): Currency => ({ code, kind: 'fiat', scale: 2 });

/** DTO → domain. An unknown currency still renders (scale 2); conversion then reports it as unconvertible. */
export function toExpense(dto: ExpenseDto, registry: CurrencyRegistry): Expense {
  const currency = registry.get(dto.currency).unwrapOr(fallback(dto.currency));
  return {
    id: dto.id,
    categoryId: dto.categoryId,
    name: dto.name,
    amount: Money.of(dto.amount, currency),
    period: dto.period,
    billingDay: dto.billingDay,
    billingMonth: dto.billingMonth,
    isEssential: dto.isEssential,
    activeFrom: dto.activeFrom,
    activeTo: dto.activeTo,
  };
}
