/**
 * What the Accounts screen is narrowed to, and the narrowing itself — pure, so
 * the sheet that edits a filter and the stack that obeys one can both be
 * tested without the other.
 *
 * Within a group the values are alternatives (EUR or USD); across groups they
 * all have to hold (a card, in Portugal, in euros). An empty group asks
 * nothing. That is the rule a person reads off a row of chips, so it is the
 * rule here.
 */
import {
  ACCOUNT_KINDS,
  CARD_TYPES,
  Money,
  daysBetween,
  lastOfMonth,
  type Account,
  type AccountKind,
  type CardType,
  type Currency,
  type IsoDate,
  type RateTable,
} from '@magermoney/domain';

/** Cards that have run out, and cards that are about to. */
export type ExpiryFilter = 'any' | 'soon' | 'expired';

/** How far ahead «скоро истекает» looks, in days: about a quarter. */
export const EXPIRING_SOON_DAYS = 90;

export interface AccountFilter {
  currencies: readonly string[];
  countries: readonly string[];
  kinds: readonly AccountKind[];
  cardTypes: readonly CardType[];
  expiry: ExpiryFilter;
  /** Lower bound of the balance in the display currency, a decimal string; `''` for none. */
  min: string;
  /** Upper bound, the same way. */
  max: string;
}

export const EMPTY_FILTER: AccountFilter = {
  currencies: [],
  countries: [],
  kinds: [],
  cardTypes: [],
  expiry: 'any',
  min: '',
  max: '',
};

/**
 * An account as the filter reads it: the domain account plus the one thing the
 * domain leaves on the DTO, the date the card is embossed with.
 */
export type FilterableAccount = Account & { expires: IsoDate | null };

export interface FilterContext {
  table: RateTable;
  display: Currency;
  today: IsoDate;
}

/** One per chip: every chosen value, the expiry and each bound. */
export function activeFilterCount(f: AccountFilter): number {
  return (
    f.currencies.length +
    f.countries.length +
    f.kinds.length +
    f.cardTypes.length +
    (f.expiry === 'any' ? 0 : 1) +
    (f.min ? 1 : 0) +
    (f.max ? 1 : 0)
  );
}

/**
 * A card is good through the last day of the month it is embossed with, so
 * that day, not the stored one, is what is compared.
 */
function expiryMatches(expires: IsoDate | null, want: ExpiryFilter, today: IsoDate): boolean {
  if (want === 'any') return true;
  if (!expires) return false;
  const left = daysBetween(today, lastOfMonth(expires));
  return want === 'expired' ? left < 0 : left >= 0 && left <= EXPIRING_SOON_DAYS;
}

const bound = (raw: string, display: Currency): Money | null =>
  raw ? Money.parse(raw, display).unwrapOr(null) : null;

export function filterAccounts<T extends FilterableAccount>(
  accounts: readonly T[],
  f: AccountFilter,
  { table, display, today }: FilterContext,
): T[] {
  const min = bound(f.min, display);
  const max = bound(f.max, display);
  const some = <V>(chosen: readonly V[], value: V | null) =>
    chosen.length === 0 || (value !== null && chosen.includes(value));

  return accounts.filter((a) => {
    if (!some(f.currencies, a.balance.currency.code)) return false;
    if (!some(f.countries, a.country)) return false;
    if (!some(f.kinds, a.kind)) return false;
    /* Card fields are null on everything that is not a card (the contract says so). */
    if (!some(f.cardTypes, a.cardType)) return false;
    if (!expiryMatches(a.expires, f.expiry, today)) return false;
    if (!min && !max) return true;
    /* An amount nobody can convert cannot be said to be above or below anything. */
    const converted = table.convert(a.balance, display.code);
    if (converted.isErr()) return false;
    const value = converted.value;
    if (min && value.compare(min).unwrapOr(-1) < 0) return false;
    if (max && value.compare(max).unwrapOr(1) > 0) return false;
    return true;
  });
}

export interface FilterChoices {
  currencies: string[];
  countries: string[];
  kinds: AccountKind[];
  cardTypes: CardType[];
  /** Whether any card says when it runs out — otherwise there is nothing to ask. */
  hasExpiry: boolean;
}

/**
 * What the sheet can offer: only what the accounts have. A filter that can
 * pick a country none of them is in can only ever empty the screen.
 */
export function filterChoices(accounts: readonly FilterableAccount[]): FilterChoices {
  const cards = accounts.filter((a) => a.kind === 'card');
  const kinds = new Set(accounts.map((a) => a.kind));
  const cardTypes = new Set(cards.map((a) => a.cardType));
  return {
    currencies: [...new Set(accounts.map((a) => a.balance.currency.code))].sort(),
    countries: [...new Set(accounts.map((a) => a.country))].sort(),
    kinds: ACCOUNT_KINDS.filter((k) => kinds.has(k)),
    cardTypes: CARD_TYPES.filter((t) => cardTypes.has(t)),
    hasExpiry: cards.some((a) => a.expires !== null),
  };
}
