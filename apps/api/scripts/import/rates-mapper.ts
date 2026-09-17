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
 */
export function mapRates(
  rows: string[][],
): Result<{ base: string; date: string; value: string }[], ImportError> {
  const yearRow = rows.find((r) => r.slice(1).some((c) => /^\d{4}$/.test(c.trim())));
  if (!yearRow) return err(new ImportError('No row of years found'));
  const years = yearRow.map((c) => c.trim());
  const out: { base: string; date: string; value: string }[] = [];
  const take = (label: RegExp, base: string, invert: boolean) => {
    const row = rows.find((r) => label.test(r[0]?.trim() ?? ''));
    if (!row) return;
    for (let i = 1; i < years.length; i++) {
      if (!/^\d{4}$/.test(years[i]!)) continue;
      const n = parseRuNumber(row[i] ?? '');
      if (n === null || n === '0') continue;
      const v = invert ? new D(1).div(n) : new D(n);
      out.push({ base, date: `${years[i]}-01-01`, value: v.toSignificantDigits(SIG).toFixed() });
    }
  };
  take(/USD\/RUB/i, 'RUB', true);
  take(/EUR\/USD/i, 'EUR', false);
  return ok(out);
}
