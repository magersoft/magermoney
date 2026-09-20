import type { AccountDto } from '@magermoney/contracts';
import { Money, type Account, type Currency, type CurrencyRegistry } from '@magermoney/domain';

const fallback = (code: string): Currency => ({ code, kind: 'fiat', scale: 2 });

/** DTO → domain. An unknown currency still gets a Money (scale 2) so the list renders; conversion then reports it as unconvertible. */
export function toAccount(dto: AccountDto, registry: CurrencyRegistry): Account {
  const currency = registry.get(dto.currency).unwrapOr(fallback(dto.currency));
  return {
    id: dto.id,
    name: dto.name,
    bank: dto.bank,
    country: dto.country,
    kind: dto.kind,
    cardType: dto.cardType,
    isSpending: dto.isSpending,
    isPinned: dto.isPinned,
    sortOrder: dto.sortOrder,
    archived: dto.archivedAt !== null,
    balance: dto.balance === null ? Money.zero(currency) : Money.of(dto.balance, currency),
  };
}
