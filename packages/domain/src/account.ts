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
 * The colours an account may be painted in. Names rather than values: what a
 * name is worth in light and in dark is the design system's business
 * (`account-card/colorways.ts`), and the same account has to be the same
 * account in both themes.
 *
 * An account with none keeps the colour of what it holds, which is what every
 * account had before the choice existed.
 *
 * The list is **append-only** and mirrored by a check constraint in
 * `supabase/migrations`: a name that leaves this list is a colour some account
 * is already painted in.
 */
export const ACCOUNT_COLORWAYS = [
  'red',
  'orange',
  'amber',
  'green',
  'teal',
  'blue',
  'violet',
  'pink',
] as const;
export type AccountColorway = (typeof ACCOUNT_COLORWAYS)[number];

/**
 * What the read models need to know about an Account. Presentation details
 * (card number, note, network) stay in the DTO; the domain only carries what
 * changes a number: the currency (through `balance`), whether it is a spending
 * account, and whether it may go negative. `isPinned` changes no number — it
 * rides along because the read models are what the Home screen reads.
 */
export interface Account {
  id: string;
  name: string;
  bank: string;
  country: string;
  kind: AccountKind;
  cardType: CardType | null;
  isSpending: boolean;
  /** The user asked for this account on the Home screen. */
  isPinned: boolean;
  sortOrder: number;
  archived: boolean;
  /** The latest Balance entry, or zero in the account's currency when there is none. */
  balance: Money;
}

/** Only a credit card may owe money; everything else stops at zero. */
export function mayGoNegative(a: Pick<Account, 'kind' | 'cardType'>): boolean {
  return a.kind === 'card' && a.cardType === 'credit';
}
