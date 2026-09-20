import { err, ok, type Result } from 'neverthrow';
import { Decimal } from '@magermoney/domain';
import { ImportError } from './accounts-mapper.js';
import { parseRuNumber } from './numbers.js';

const D = Decimal.clone({ precision: 40 });
const SIG = 10;

/**
 * The "Курсы пересчёта" block: a row of years, then "Курс USD/RUB" (rubles per
 * dollar → stored as 1/x) and "Курс EUR/USD" (dollars per euro → stored as is).
 * Every value is dated January 1 of its year.
 *
 * A rate row is found by what it *is*, not by a mention of what it is about.
 * The sheets these come from open with a prose subtitle that names both rates
 * in one sentence, and a substring match hands that sentence back instead of
 * the numbers — silently, because the subtitle's own columns are empty. So a
 * candidate has to both carry the label and hold at least one readable number
 * under a year; the first row that does is the block.
 */
export function mapRates(
  rows: string[][],
): Result<{ base: string; date: string; value: string }[], ImportError> {
  const yearRow = rows.find((r) => r.slice(1).some((c) => /^\d{4}$/.test(c.trim())));
  if (!yearRow) return err(new ImportError('No row of years found'));
  const years = yearRow.map((c) => c.trim());
  const yearColumns = years.flatMap((y, i) => (i > 0 && /^\d{4}$/.test(y) ? [i] : []));

  const valuesOf = (row: string[]) =>
    yearColumns.flatMap((i) => {
      const n = parseRuNumber(row[i] ?? '');
      return n === null || n === '0' ? [] : [{ year: years[i]!, n }];
    });

  const out: { base: string; date: string; value: string }[] = [];
  const take = (label: RegExp, base: string, invert: boolean): boolean => {
    for (const row of rows) {
      if (!label.test(row[0]?.trim() ?? '')) continue;
      const values = valuesOf(row);
      /* A label with nothing under it is a heading, not the block. Keep looking. */
      if (values.length === 0) continue;
      for (const { year, n } of values) {
        const v = invert ? new D(1).div(n) : new D(n);
        out.push({ base, date: `${year}-01-01`, value: v.toSignificantDigits(SIG).toFixed() });
      }
      return true;
    }
    return false;
  };

  const usd = take(/USD\/RUB/i, 'RUB', true);
  const eur = take(/EUR\/USD/i, 'EUR', false);
  /*
   * Neither row found is a file we failed to read, not a file without rates.
   * Returning an empty list here is how a mis-read block used to reach the
   * summary as "0 rates" and be taken for an answer.
   */
  if (!usd && !eur)
    return err(new ImportError('No rate row found: expected "Курс USD/RUB" or "Курс EUR/USD"'));
  return ok(out);
}
