import type { AssetDto, ValuationDto } from '@magermoney/contracts';
import {
  Money,
  type Asset,
  type Currency,
  type CurrencyRegistry,
  type Valuation,
} from '@magermoney/domain';

const fallback = (code: string): Currency => ({ code, kind: 'fiat', scale: 2 });

/** DTO → domain. An unknown currency still renders (scale 2); the total then reports it as unconvertible. */
export function toAsset(dto: AssetDto, registry: CurrencyRegistry): Asset {
  const currency = registry.get(dto.currency).unwrapOr(fallback(dto.currency));
  return {
    id: dto.id,
    name: dto.name,
    icon: dto.icon,
    color: dto.color,
    value: dto.value === null ? null : Money.of(dto.value, currency),
    valuedOn: dto.valuedOn,
    countsInTotal: dto.countsInTotal,
    acquiredOn: dto.acquiredOn,
    purchasePrice: dto.purchasePrice === null ? null : Money.of(dto.purchasePrice, currency),
    archived: dto.archivedAt !== null,
  };
}

export function toValuation(dto: ValuationDto, currency: Currency): Valuation {
  return { id: dto.id, value: Money.of(dto.value, currency), valuedOn: dto.valuedOn };
}
