import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../scripts/import/csv.js';
import { parseRuNumber } from '../../scripts/import/numbers.js';

describe('parseCsv', () => {
  it('handles quotes, embedded commas, newlines and CRLF', () => {
    expect(parseCsv('a,b\r\n"x, y","line1\nline2"\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'line1\nline2'],
    ]);
    expect(parseCsv('a,"he said ""hi"""')).toEqual([['a', 'he said "hi"']]);
  });
});

describe('parseRuNumber', () => {
  it('reads spreadsheet numbers into decimal strings', () => {
    expect(parseRuNumber('2 100 675,19')).toBe('2100675.19');
    expect(parseRuNumber('0,00')).toBe('0');
    expect(parseRuNumber('14 000,00')).toBe('14000');
    expect(parseRuNumber('$1 259,80')).toBe('1259.80');
    expect(parseRuNumber('-')).toBeNull();
    expect(parseRuNumber('')).toBeNull();
    expect(parseRuNumber('abc')).toBeNull();
  });
});
