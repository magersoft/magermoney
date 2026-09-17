import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../scripts/import/csv.js';
import { mapRates } from '../../scripts/import/rates-mapper.js';

const CSV = [
  'Курсы пересчёта,,,',
  ',2015,2016,2017',
  'Курс USD/RUB,"60,14","69,72",',
  'Курс EUR/USD,"1,110","1,107","1,130"',
].join('\n');

describe('mapRates', () => {
  it('turns the yearly block into Jan-1 USD-based rates, skipping blanks', () => {
    const rates = mapRates(parseCsv(CSV))._unsafeUnwrap();
    expect(rates).toEqual([
      { base: 'RUB', date: '2015-01-01', value: '0.01662786831' },
      { base: 'RUB', date: '2016-01-01', value: '0.01434308663' },
      { base: 'EUR', date: '2015-01-01', value: '1.11' },
      { base: 'EUR', date: '2016-01-01', value: '1.107' },
      { base: 'EUR', date: '2017-01-01', value: '1.13' },
    ]);
  });
  it('fails when the year header is missing', () => {
    expect(mapRates(parseCsv('a,b\n1,2')).isErr()).toBe(true);
  });
});
