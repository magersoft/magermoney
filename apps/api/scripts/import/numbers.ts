import { Decimal } from '@magermoney/domain';

/** "2 100 675,19", "$1 259,80", "0,00" → "2100675.19", "1259.80", "0". Anything else → null. */
export function parseRuNumber(raw: string): string | null {
  const s = raw
    .replace(/[\s ]/g, '')
    .replace(/[^\d,.-]/g, '')
    .replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const [int, frac] = s.split('.') as [string, string | undefined];
  const cleanInt = int.replace(/^(-?)0+(?=\d)/, '$1');
  if (frac === undefined || /^0+$/.test(frac)) return cleanInt;
  return `${cleanInt}.${frac}`;
}

/** "15%", "7,5 %" → "0.15", "0.075"; an empty cell → "0". Unparsable or outside [0, 1) → null. */
export function parsePercent(raw: string): string | null {
  if (raw.trim() === '') return '0';
  const n = parseRuNumber(raw);
  if (n === null) return null;
  const v = new Decimal(n).div(100);
  return v.gte(0) && v.lt(1) ? v.toFixed() : null;
}

/** "23.01.2025" → "2025-01-23". A date the calendar does not have (31.02) → null. */
export function parseRuDate(raw: string): string | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null;
}
