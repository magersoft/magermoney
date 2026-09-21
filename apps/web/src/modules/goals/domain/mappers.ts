import type { GoalDto } from '@magermoney/contracts';
import { Money, type Currency, type CurrencyRegistry, type Goal } from '@magermoney/domain';

const fallback = (code: string): Currency => ({ code, kind: 'fiat', scale: 2 });

/** DTO → domain. An unknown currency still renders (scale 2); progress then reports it as unconvertible. */
export function toGoal(dto: GoalDto, registry: CurrencyRegistry): Goal {
  const currency = registry.get(dto.currency).unwrapOr(fallback(dto.currency));
  return {
    id: dto.id,
    name: dto.name,
    icon: dto.icon,
    target: Money.of(dto.targetAmount, currency),
    targetDate: dto.targetDate,
    achievedAt: dto.achievedAt,
    archivedAt: dto.archivedAt,
    sortOrder: dto.sortOrder,
  };
}
