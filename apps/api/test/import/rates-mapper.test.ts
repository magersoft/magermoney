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

  /*
   * The real export opens with a prose subtitle that names both rates in one
   * sentence — «Доход помесячно с 2015 г. • USD/RUB — твои годовые курсы
   * EUR/USD — годовые средние». Matched as a substring it wins over the rows
   * that hold the numbers, because it comes first, and its own columns are
   * empty. The block is found by its label, not by a mention of it.
   */
  it('is not fooled by a subtitle that mentions both rates', () => {
    const withSubtitle = [
      'Доход помесячно с 2015 г. • USD/RUB — твои годовые курсы EUR/USD — годовые средние,,,',
      CSV,
    ].join('\n');
    const rates = mapRates(parseCsv(withSubtitle))._unsafeUnwrap();
    expect(rates).toHaveLength(5);
    expect(rates[0]).toEqual({ base: 'RUB', date: '2015-01-01', value: '0.01662786831' });
  });

  /*
   * A label with nothing under it is not the row either: the sheet can repeat a
   * heading above the block, and picking the empty one yields zero rates while
   * reporting success.
   */
  it('skips a labelled row that carries no numbers and takes the one that does', () => {
    const twice = ['Курс USD/RUB,,,', ',2015,2016,2017', 'Курс USD/RUB,"60,14",,'].join('\n');
    expect(mapRates(parseCsv(twice))._unsafeUnwrap()).toEqual([
      { base: 'RUB', date: '2015-01-01', value: '0.01662786831' },
    ]);
  });

  /*
   * And when neither row holds a number, that is a file we failed to read, not
   * a file with no rates in it. The two used to print the same «0 rates».
   */
  it('fails rather than reporting an empty block as an answer', () => {
    const none = ['Курсы пересчёта,,,', ',2015,2016,2017', 'Курс чего-то ещё,1,2,3'].join('\n');
    expect(mapRates(parseCsv(none)).isErr()).toBe(true);
  });
});
