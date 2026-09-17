/** "2 100 675,19", "$1 259,80", "0,00" → "2100675.19", "1259.80", "0". Anything else → null. */
export function parseRuNumber(raw: string): string | null {
  const s = raw
    .replace(/[\s ]/g, '')
    .replace(/[^\d,.-]/g, '')
    .replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const [int, frac] = s.split('.') as [string, string | undefined];
  const cleanInt = int.replace(/^(-?)0+(?=\d)/, '$1');
  if (frac === undefined || /^0+$/.test(frac)) return cleanInt;
  return `${cleanInt}.${frac}`;
}
