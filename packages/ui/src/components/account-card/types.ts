/**
 * What a card needs to know about an account. Plain values, never the domain
 * `Account` — the design system depends on Vue and Tailwind and nothing else,
 * so the amount arrives as the exact decimal string it is stored as.
 */
export interface AccountCardItem {
  id: string;
  name: string;
  /**
   * Where the card leads. Rendered as `href` on an anchor and as `to` on
   * whatever `as` the screen hands the card — a router link, usually.
   */
  href?: string;
  /** The balance, exactly as stored. */
  amount: string;
  /** ISO code or crypto ticker. */
  code: string;
  kind: 'fiat' | 'crypto';
  /** ISO 3166-1 alpha-2 country the account is held in. It decides the mark. */
  country?: string | null;
  /** Fraction digits. Two unless the currency says otherwise. */
  scale?: number;
  /** The account the user keeps on the home screen. Drawn as a pin on the card. */
  pinned?: boolean;
  /** What the pin is announced as. The design system has no words of its own. */
  pinnedLabel?: string;
  /**
   * The colour the owner painted this card, by name (`colorways.ts`). Absent
   * means the colour of what the account holds, which is what every account had
   * before the choice existed.
   */
  colorway?: string | null;
  /**
   * Whether this account is a payment card. It decides which furniture the
   * card's foot carries: a card shows its last digits and its expiry, anything
   * else shows where it is held.
   */
  isCard?: boolean;
  /**
   * The payment network as the owner typed it — «Visa», «Master Card», «МИР».
   * Matched down to a scheme by `card-brand.ts`; an unrecognised one simply
   * leaves the brand slot empty.
   */
  network?: string | null;
  /**
   * The last four digits of the card. Four digits is all we ever hold: a full
   * number is never stored, never sent and never shown.
   */
  last4?: string | null;
  /** The expiry as `MM/YY`, already formatted — the design system does no dates. */
  expires?: string | null;
  /**
   * The foot of a card that is not a payment card: where the money is kept,
   * usually the bank and the country. The screen composes it, because what is
   * worth saying differs between a deposit and a wallet.
   */
  reference?: string | null;
}
