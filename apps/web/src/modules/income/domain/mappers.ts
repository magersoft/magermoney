import type { IncomeSourceDto, InflowDto } from '@magermoney/contracts';
import {
  Decimal,
  Money,
  type Currency,
  type CurrencyRegistry,
  type IncomeSource,
  type Inflow,
} from '@magermoney/domain';

const fallback = (code: string): Currency => ({ code, kind: 'fiat', scale: 2 });
const currencyOf = (code: string, registry: CurrencyRegistry): Currency =>
  registry.get(code).unwrapOr(fallback(code));

/** DTO → domain. An unknown currency still gets a Money (scale 2) so the list renders; conversion then reports it as unconvertible. */
export function toIncomeSource(dto: IncomeSourceDto, registry: CurrencyRegistry): IncomeSource {
  return {
    id: dto.id,
    name: dto.name,
    grossAmount: Money.of(dto.grossAmount, currencyOf(dto.currency, registry)),
    taxRate: new Decimal(dto.taxRate),
    commissionRate: new Decimal(dto.commissionRate),
    payDays: [...dto.payDays],
    isPrimary: dto.isPrimary,
    activeFrom: dto.activeFrom,
    activeTo: dto.activeTo,
    defaultAccountId: dto.defaultAccountId,
  };
}

/**
 * The DTO carries `creditedAmount` without a currency: it is the Account's. A
 * caller that knows the Account passes its code; one that does not (the
 * dashboard's read models never look at the credit) gets `null` rather than an
 * amount in a guessed currency.
 */
export function toInflow(
  dto: InflowDto,
  registry: CurrencyRegistry,
  accountCurrency?: string,
): Inflow {
  return {
    id: dto.id,
    incomeSourceId: dto.incomeSourceId,
    amount: Money.of(dto.amount, currencyOf(dto.currency, registry)),
    receivedOn: dto.receivedOn,
    realisedRateToUsd: dto.realisedRateToUsd === null ? null : new Decimal(dto.realisedRateToUsd),
    accountId: dto.accountId,
    creditedAmount:
      dto.creditedAmount !== null && accountCurrency
        ? Money.of(dto.creditedAmount, currencyOf(accountCurrency, registry))
        : null,
    note: dto.note,
  };
}
