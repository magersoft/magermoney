/**
 * Text ↔ decimal string for amount fields. No `Number` anywhere: the value the
 * field emits is the exact string the domain's `Money.parse` accepts (ADR 0001).
 */
const SPACES = /[\s ]/g;

export function parseAmountInput(
  raw: string,
  scale: number,
  allowNegative: boolean,
): string | null {
  const s = raw.replace(SPACES, '').replace(',', '.');
  if (s === '' || s === '-') return '';
  const m = /^(-)?(\d+)(?:\.(\d*))?$/.exec(s);
  if (!m) return null;
  const [, sign, int, frac = ''] = m;
  if (sign && !allowNegative) return null;
  if (frac.length > scale) return null;
  const normalisedInt = int!.replace(/^0+(?=\d)/, '');
  const value = frac.length > 0 ? `${normalisedInt}.${frac}` : normalisedInt;
  return sign ? `-${value}` : value;
}

/** Grouped digits with the locale's separators; the fraction is kept as typed, never rounded. */
export function formatAmountInput(decimal: string, locale: 'ru' | 'en'): string {
  if (decimal === '') return '';
  const [intPart, frac] = decimal.replace('-', '').split('.') as [string, string | undefined];
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, locale === 'ru' ? ' ' : ',');
  const sep = locale === 'ru' ? ',' : '.';
  const sign = decimal.startsWith('-') ? '-' : '';
  return frac === undefined ? `${sign}${grouped}` : `${sign}${grouped}${sep}${frac}`;
}
