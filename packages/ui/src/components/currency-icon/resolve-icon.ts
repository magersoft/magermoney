/**
 * ISO 4217 code -> circle-flags name. Exported because `src/index.ts` builds the
 * registered icon subset from it — the two must not drift apart. Codes absent here fall back to initials,
 * which is the honest answer for a currency we have no flag for.
 */
export const FIAT_FLAG: Record<string, string> = {
  USD: 'us',
  EUR: 'european-union',
  RUB: 'ru',
  KZT: 'kz',
  UZS: 'uz',
  IDR: 'id',
  EGP: 'eg',
  GEL: 'ge',
  KGS: 'kg',
  GBP: 'gb',
  TRY: 'tr',
  AED: 'ae',
  CNY: 'cn',
  JPY: 'jp',
  CHF: 'ch',
  PLN: 'pl',
  CZK: 'cz',
  AMD: 'am',
  BYN: 'by',
  UAH: 'ua',
  THB: 'th',
  VND: 'vn',
};

/** Tickers present in `@iconify-json/cryptocurrency-color`. */
export const CRYPTO_KNOWN: ReadonlySet<string> = new Set([
  'btc',
  'eth',
  'usdt',
  'xrp',
  'sol',
  'doge',
  'avax',
  'atom',
  'trx',
  'bnb',
  'ada',
  'dot',
  'ltc',
  'matic',
  'link',
  'usdc',
]);

export type ResolvedIcon = { kind: 'iconify'; name: string } | { kind: 'initials'; text: string };

export interface CurrencyIconInput {
  code: string;
  kind: 'fiat' | 'crypto';
  /** Explicit Iconify name; wins over everything. */
  icon?: string | null;
  /**
   * ISO 3166-1 alpha-2 country the account is held in. It outranks the currency
   * table: a euro account in Lisbon is Portuguese, and the EU flag on it would
   * say something the account does not.
   */
  country?: string | null;
}

/**
 * Picks how a currency should be drawn. Never throws and never returns nothing:
 * the last resort is the first two letters of the code, which always reads.
 */
export function resolveCurrencyIcon(c: CurrencyIconInput): ResolvedIcon {
  if (c.icon) return { kind: 'iconify', name: c.icon };
  if (c.kind === 'fiat') {
    const flag = (c.country ? c.country.toLowerCase() : undefined) ?? FIAT_FLAG[c.code];
    if (flag) return { kind: 'iconify', name: `circle-flags:${flag}` };
  }
  if (c.kind === 'crypto') {
    const ticker = c.code.toLowerCase();
    if (CRYPTO_KNOWN.has(ticker))
      return { kind: 'iconify', name: `cryptocurrency-color:${ticker}` };
  }
  return { kind: 'initials', text: c.code.slice(0, 2).toUpperCase() };
}
