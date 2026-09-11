import type { Money } from './money.js';

export const ACCOUNT_KINDS = [
  'bank_account',
  'card',
  'deposit',
  'broker',
  'crypto_wallet',
  'cash',
] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];
export const CARD_TYPES = ['debit', 'credit'] as const;
export type CardType = (typeof CARD_TYPES)[number];

/**
 * What the read models need to know about an Account. Presentation details
 * (card number, note, network) stay in the DTO; the domain only carries what
 * changes a number: the currency (through `balance`), whether it is a spending
 * account, and whether it may go negative.
 */
export interface Account {
  id: string;
  name: string;
  bank: string;
  country: string;
  kind: AccountKind;
  cardType: CardType | null;
  isSpending: boolean;
  sortOrder: number;
  archived: boolean;
  /** The latest Balance entry, or zero in the account's currency when there is none. */
  balance: Money;
}

/** Only a credit card may owe money; everything else stops at zero. */
export function mayGoNegative(a: Pick<Account, 'kind' | 'cardType'>): boolean {
  return a.kind === 'card' && a.cardType === 'credit';
}
