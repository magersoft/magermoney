import type { CurrencyDto, RateDto } from '@magermoney/contracts';
import { Decimal, type Currency, type Rate } from '@magermoney/domain';

/**
 * The DTO boundary. Amounts and rates cross it as strings (ADR 0001) and become
 * `Decimal` here, once, so nothing downstream is tempted to treat a rate as a
 * number.
 */
export function toRate(dto: RateDto): Rate {
  return { base: dto.base, quote: dto.quote, value: new Decimal(dto.value), date: dto.date, source: dto.source };
}

/**
 * A currency the backend knows, as the domain knows it. The registry is built
 * from this, so a currency added to the database needs no release.
 */
export function toCurrency(dto: CurrencyDto): Currency {
  return dto.symbol === null
    ? { code: dto.code, kind: dto.kind, scale: dto.scale }
    : { code: dto.code, kind: dto.kind, scale: dto.scale, symbol: dto.symbol };
}
