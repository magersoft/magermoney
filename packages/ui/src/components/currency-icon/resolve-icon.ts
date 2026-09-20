import { COUNTRY_CODES } from './countries';

/**
 * Currency flags that ship in the eagerly-registered subset: the ones an
 * account screen paints on first render.
 *
 * Every other fiat currency also gets a flag, derived below, but from the lazy
 * country chunk — a picker of 157 currencies is a beat later than first paint,
 * and 200KB of flags is not worth the entry bundle.
 *
 * Exported because `src/index.ts` and `scripts/build-icon-subset.ts` both build
 * the eager subset from it; the two must not drift apart.
 */
export const CORE_FIAT_FLAG: Record<string, string> = {
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

/** Flag names registered before anything renders. */
export const EAGER_FLAGS: ReadonlySet<string> = new Set(Object.values(CORE_FIAT_FLAG));

/**
 * Currencies whose code does not begin with the country that issues them.
 *
 * The supranational ones are left out on purpose: the CFA francs, the East
 * Caribbean dollar and the CFP franc belong to a dozen countries each, and any
 * flag would name the wrong one. They fall back to initials, which says nothing
 * untrue.
 */
const FIAT_FLAG_EXCEPTION: Record<string, string> = {
  /* Both guilders are Curaçao's. */
  ANG: 'cw',
  XCG: 'cw',
};

const COUNTRY_SET: ReadonlySet<string> = new Set(COUNTRY_CODES);

/**
 * The flag for a fiat currency, or `undefined` when there is none to show.
 *
 * ISO 4217 builds most codes from the ISO 3166 country plus a letter for the
 * unit — USD, COP, JPY — so the country is the first two characters. Deriving
 * it rather than listing 157 pairs also ties the two constraints together: a
 * currency shows a flag exactly when we ship that country's, because the same
 * list answers both questions.
 */
export function fiatFlag(code: string): string | undefined {
  const core = CORE_FIAT_FLAG[code];
  if (core) return core;
  const exception = FIAT_FLAG_EXCEPTION[code];
  if (exception) return exception;
  const country = code.slice(0, 2).toUpperCase();
  return COUNTRY_SET.has(country) ? country.toLowerCase() : undefined;
}

/**
 * Tickers present in `@iconify-json/cryptocurrency-color`, and so the coins
 * that draw as a mark rather than as their first two letters. The collection
 * has nothing for most of the newer tokens, and initials are the honest answer
 * there — `scripts/build-icon-subset.ts` throws if a name here does not exist.
 */
export const CRYPTO_KNOWN: ReadonlySet<string> = new Set([
  'aave',
  'ada',
  'algo',
  'atom',
  'avax',
  'bch',
  'bnb',
  'btc',
  'chz',
  'crv',
  'dai',
  'dash',
  'doge',
  'dot',
  'eos',
  'etc',
  'eth',
  'fil',
  'grt',
  'icp',
  'leo',
  'link',
  'ltc',
  'mana',
  'mkr',
  'neo',
  'paxg',
  'qnt',
  'sand',
  'sol',
  'stx',
  'trx',
  'uni',
  'usdc',
  'usdt',
  'vet',
  'xlm',
  'xmr',
  'xrp',
  'xtz',
  'zec',
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
    const flag = (c.country ? c.country.toLowerCase() : undefined) ?? fiatFlag(c.code);
    if (flag) return { kind: 'iconify', name: `circle-flags:${flag}` };
  }
  if (c.kind === 'crypto') {
    const ticker = c.code.toLowerCase();
    if (CRYPTO_KNOWN.has(ticker))
      return { kind: 'iconify', name: `cryptocurrency-color:${ticker}` };
  }
  return { kind: 'initials', text: c.code.slice(0, 2).toUpperCase() };
}
