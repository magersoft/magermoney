import type { BudgetDto } from '@magermoney/contracts';
import { Money, type Budget, type Currency, type CurrencyRegistry } from '@magermoney/domain';

const fallback = (code: string): Currency => ({ code, kind: 'fiat', scale: 2 });

/** DTO → domain. An unknown currency still renders (scale 2); conversion then reports it as unconvertible. */
export function toBudget(dto: BudgetDto, registry: CurrencyRegistry): Budget {
  const currency = registry.get(dto.currency).unwrapOr(fallback(dto.currency));
  return {
    id: dto.id,
    name: dto.name,
    icon: dto.icon,
    monthlyLimit: Money.of(dto.monthlyLimit, currency),
    activeFrom: dto.activeFrom,
    activeTo: dto.activeTo,
  };
}
