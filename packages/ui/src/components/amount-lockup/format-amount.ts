/**
 * The signature lockup, as data: the symbol that leads, the integer, the
 * fraction that is set smaller, and the code that sometimes has to follow.
 * `AmountLockup.vue` only puts these in spans — the rules live here so they can
 * be read in a test rather than in a rendered tree.
 *
 * Display only, never arithmetic: the exact value lives in `Money` (decimal end
 * to end, ADR 0001) and reaches here as the string it was stored as. It is
 * handed to `Intl` as that string, not as a `Number`, so a balance past 2^53
 * still prints the digits it was given.
 */

export type AmountLocale = 'ru' | 'en';

export interface AmountLockupOptions {
  /** ISO code or crypto ticker. Case does not matter; it is shown upper. */
  code: string;
  locale?: AmountLocale;
  /**
   * Overrides the resolved symbol. `null` means "this currency has none" and
   * hands the leading place to the code.
   */
  symbol?: string | null;
  /** Fraction digits. Two for fiat; crypto passes its own. */
  scale?: number;
  /** Repeats the code after the number, for a screen where a glyph is shared. */
  showCode?: boolean;
  /** A change, not a balance: a positive value gets an explicit plus. */
  signed?: boolean;
}

export interface AmountLockupParts {
  /** `''`, `'−'` (U+2212) or `'+'` — never the hyphen `Intl` would produce. */
  sign: string;
  /** What stands before the number: the symbol, or the code when there is none. */
  lead: { kind: 'symbol' | 'code'; text: string };
  /** Grouped, in the locale's separators. */
  integer: string;
  /** Decimal separator included — it is set small along with the digits. */
  fraction: string | null;
  /** The trailing code, only when asked for and not already leading. */
  code: string | null;
}

const MINUS = '−';

function intlLocale(locale: AmountLocale): string {
  return locale === 'ru' ? 'ru-RU' : 'en-US';
}

/**
 * The narrow symbol of a currency, or `null` when it has none. `Intl` answers
 * with the code itself for USDT-shaped tickers (and throws outright on a
 * four-letter one), which is exactly the case the lockup renders in mono caps.
 */
export function resolveCurrencySymbol(code: string, locale: AmountLocale = 'en'): string | null {
  const upper = code.toUpperCase();
  if (!/^[A-Z]{3}$/.test(upper)) return null;
  try {
    const symbol = new Intl.NumberFormat(intlLocale(locale), {
      style: 'currency',
      currency: upper,
      currencyDisplay: 'narrowSymbol',
    })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value;
    return symbol && symbol !== upper ? symbol : null;
  } catch {
    return null;
  }
}

export function formatAmountLockup(
  amount: string,
  options: AmountLockupOptions,
): AmountLockupParts {
  const code = options.code.toUpperCase();
  const locale = options.locale ?? 'en';
  const scale = options.scale ?? 2;

  const negative = /^-/.test(amount);
  const magnitude = amount.replace(/^[+-]/, '').trim();
  // `-0.00` is not a negative balance, it is zero written down oddly.
  const zero = !/[1-9]/.test(magnitude);

  const formatter = new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: Math.min(2, scale),
    maximumFractionDigits: scale,
  });
  // `Intl` v3 formats a decimal string exactly; a malformed one still has to
  // render something, so the fallback is the number it parses to.
  const parts = /^\d*\.?\d*$/.test(magnitude)
    ? formatter.formatToParts(magnitude as unknown as number)
    : formatter.formatToParts(Number(magnitude));

  let integer = '';
  let fraction = '';
  for (const part of parts) {
    if (part.type === 'integer' || part.type === 'group') integer += part.value;
    else if (part.type === 'decimal' || part.type === 'fraction') fraction += part.value;
  }

  const symbol =
    options.symbol === undefined ? resolveCurrencySymbol(code, locale) : options.symbol;
  const lead: AmountLockupParts['lead'] = symbol
    ? { kind: 'symbol', text: symbol }
    : { kind: 'code', text: code };

  return {
    sign: zero ? '' : negative ? MINUS : options.signed ? '+' : '',
    lead,
    integer,
    fraction: fraction || null,
    code: options.showCode && lead.kind === 'symbol' ? code : null,
  };
}

/** The same amount as one string — what a screen reader is given to read. */
export function plainAmount(parts: AmountLockupParts): string {
  const lead = parts.lead.kind === 'symbol' ? parts.lead.text : `${parts.lead.text} `;
  const tail = parts.code ? ` ${parts.code}` : '';
  return `${parts.sign}${lead}${parts.integer}${parts.fraction ?? ''}${tail}`;
}
