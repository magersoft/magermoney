/**
 * Display formatting for amounts. Never arithmetic: the exact value lives in
 * `Money` (decimal end to end, ADR 0001) and only reaches here to be shown.
 */

export type MoneyLocale = 'ru' | 'en';

export interface FormatMoneyOptions {
  /** Fraction digits for currencies `Intl` does not know (crypto). */
  scale?: number;
  /** Symbol for a non-ISO currency; `null` keeps the code itself. */
  symbol?: string | null;
  /** Replaces the digits with a mask, keeping the currency legible. */
  hide?: boolean;
}

const HIDDEN = '••••';
const NUMERIC_PARTS = new Set<Intl.NumberFormatPartTypes>([
  'integer',
  'group',
  'decimal',
  'fraction',
]);

function intlLocale(locale: MoneyLocale): string {
  return locale === 'ru' ? 'ru-RU' : 'en-US';
}

export function formatMoney(
  amount: string,
  code: string,
  locale: MoneyLocale,
  opts: FormatMoneyOptions = {},
): string {
  const n = Number(amount);
  const isIso = /^[A-Z]{3}$/.test(code) && opts.symbol == null;

  if (isIso) {
    const f = new Intl.NumberFormat(intlLocale(locale), {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    });
    if (!opts.hide) return f.format(n);

    // The mask replaces the whole number, so the first numeric part becomes it
    // and the rest are dropped — separators included.
    let masked = false;
    return f
      .formatToParts(n)
      .map((part) => {
        if (!NUMERIC_PARTS.has(part.type)) return part.value;
        if (masked) return '';
        masked = true;
        return HIDDEN;
      })
      .join('');
  }

  const scale = opts.scale ?? 2;
  const f = new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: Math.min(2, scale),
    maximumFractionDigits: scale,
  });
  const digits = opts.hide ? HIDDEN : f.format(n);
  const symbol = opts.symbol ?? code;
  return locale === 'ru' ? `${digits} ${symbol}` : `${symbol}${digits}`;
}
