/**
 * Text ↔ fraction for tax and commission fields. A rate is a decimal string in
 * [0, 1) end to end (ADR 0001), so the point is moved by slicing the string —
 * `15 / 100` would hand the domain 0.15000000000000002 sooner or later.
 */
const NOISE = /[\s  %]/g;

/** "15,5" → "0.155". Empty means zero. Null when the text is not a percentage below 100 with at most two decimals. */
export function percentToFraction(raw: string): string | null {
  const s = raw.replace(NOISE, '').replace(',', '.');
  if (s === '') return '0';
  const m = /^(\d{1,2})(?:\.(\d{0,2}))?$/.exec(s);
  if (!m) return null;
  const digits = `${(m[1] ?? '0').padStart(2, '0')}${m[2] ?? ''}`.replace(/0+$/, '');
  return digits === '' ? '0' : `0.${digits}`;
}

/** "0.155" → "15.5". The input is a fraction below one; anything before the point is ignored. */
export function fractionToPercent(fraction: string): string {
  const frac = (fraction.split('.')[1] ?? '').padEnd(2, '0');
  const int = frac.slice(0, 2).replace(/^0(?=\d)/, '');
  const rest = frac.slice(2).replace(/0+$/, '');
  return rest === '' ? int : `${int}.${rest}`;
}
