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
}
