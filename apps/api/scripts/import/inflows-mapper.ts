import { err, ok, type Result } from 'neverthrow';
import { Decimal } from '@magermoney/domain';
import { ImportError } from './accounts-mapper.js';
import { cellOf, findBlock } from './block.js';
import type { MappedIncomeSource } from './income-mapper.js';
import { isWhole, type NativeOptions } from './native-currency.js';
import { parseRuDate, parseRuNumber } from './numbers.js';

const D = Decimal.clone({ precision: 40 });
const SIG = 10;

export interface MappedInflow {
  /** Income source name, as in the "Откуда" column. */
  source: string;
  amount: string;
  currency: string;
  /** YYYY-MM-DD */
  receivedOn: string;
  /** USD per one unit of `currency` on that day; null for a USD inflow. */
  realisedRateToUsd: string | null;
}

export interface InflowSpan {
  first: string;
  last: string;
}

export interface InflowMapOptions extends NativeOptions {
  known: ReadonlySet<string>;
  /** Name → currency of the sources that exist: the sources sheet of this run, or the database. */
  sources: ReadonlyMap<string, string>;
  /** True when the sources sheet is part of this run: a name it lacks becomes a new source. */
  createMissing: boolean;
}

export interface MappedInflows {
  inflows: MappedInflow[];
  /** Sources named only in "Откуда": gross 0, no pay days; the runner dates them by their span. */
  created: MappedIncomeSource[];
  /** First and last inflow date per source name. */
  spans: Map<string, InflowSpan>;
}

interface RawInflow {
  line: number;
  source: string;
  receivedOn: string;
  usdRub: string | null;
  rub: string | null;
  usd: string | null;
}

/**
 * A source that exists only in the inflows sheet has no row to read a currency
 * from. Its inflows show RUB and USD side by side; the native column is the one
 * that is whole-numbered in more of its rows. A tie takes the fallback and is
 * flagged — and unless the fallback is RUB or USD the run then stops, asking
 * for --currency-of.
 */
function guessCurrency(name: string, rows: RawInflow[], opts: NativeOptions) {
  const override = opts.currencyOf.get(name);
  if (override !== undefined) return { currency: override, ambiguous: false };
  const whole = (v: string | null) => v !== null && v !== '0' && isWhole(v);
  const rub = rows.filter((r) => whole(r.rub)).length;
  const usd = rows.filter((r) => whole(r.usd)).length;
  if (rub > usd) return { currency: 'RUB', ambiguous: false };
  if (usd > rub) return { currency: 'USD', ambiguous: false };
  return { currency: opts.fallback, ambiguous: true };
}

/**
 * The "Поступления" sheet: Дата, Откуда, USD/RUB, RUB, USD, then a summary
 * block to the right that is ignored. An inflow is stored in its source's
 * currency: the RUB column with the day's realised rate (1 / USD/RUB), or the
 * USD column with no rate. Every problem is collected so one run lists them all.
 */
export function mapInflows(
  rows: string[][],
  opts: InflowMapOptions,
): Result<MappedInflows, ImportError> {
  const found = findBlock(rows, 'Дата');
  if (found.isErr()) return err(found.error);
  const block = found.value;
  const problems: string[] = [];
  const raw: RawInflow[] = [];
  for (let i = block.headerRow + 1; i < rows.length; i++) {
    const row = rows[i]!;
    const dateCell = cellOf(block, row, 'Дата');
    const source = cellOf(block, row, 'Откуда').replace(/\s+/g, ' ');
    if (dateCell === '' && source === '') continue;
    const receivedOn = parseRuDate(dateCell);
    if (receivedOn === null || source === '') {
      problems.push(`Row ${i + 1}: needs a DD.MM.YYYY date and a source`);
      continue;
    }
    raw.push({
      line: i + 1,
      source,
      receivedOn,
      usdRub: parseRuNumber(cellOf(block, row, 'USD/RUB')),
      rub: parseRuNumber(cellOf(block, row, 'RUB')),
      usd: parseRuNumber(cellOf(block, row, 'USD')),
    });
  }

  const bySource = new Map<string, RawInflow[]>();
  for (const r of raw) bySource.set(r.source, [...(bySource.get(r.source) ?? []), r]);

  const currencyOfSource = new Map(opts.sources);
  const created: MappedIncomeSource[] = [];
  const missing: string[] = [];
  for (const [name, list] of bySource) {
    if (currencyOfSource.has(name)) continue;
    if (!opts.createMissing) {
      missing.push(name);
      continue;
    }
    const guess = guessCurrency(name, list, opts);
    currencyOfSource.set(name, guess.currency);
    created.push({
      name,
      currency: guess.currency,
      grossAmount: '0',
      taxRate: '0',
      commissionRate: '0',
      ambiguous: guess.ambiguous,
    });
  }
  if (missing.length > 0)
    problems.push(
      `No income source named ${missing.map((n) => `"${n}"`).join(', ')}; create it first or pass --income-sources`,
    );

  const inflows: MappedInflow[] = [];
  const spans = new Map<string, InflowSpan>();
  const unreadable = new Set<string>();
  for (const r of raw) {
    const currency = currencyOfSource.get(r.source);
    if (currency === undefined) continue; // already reported as missing
    if (!opts.known.has(currency)) {
      problems.push(
        `Row ${r.line}: unknown currency ${currency}; add it to the currencies table first`,
      );
      continue;
    }
    if (currency !== 'RUB' && currency !== 'USD') {
      // Once per source, not once per row: the fix is one flag.
      if (!unreadable.has(r.source)) {
        unreadable.add(r.source);
        problems.push(
          `Income source "${r.source}" is in ${currency}, but the inflows sheet only has RUB and USD amounts; pass --currency-of "${r.source}=RUB" or --currency-of "${r.source}=USD"`,
        );
      }
      continue;
    }
    const amount = currency === 'RUB' ? r.rub : r.usd;
    if (amount === null || !new D(amount).gt(0)) {
      problems.push(`Row ${r.line}: the ${currency} amount must be greater than zero`);
      continue;
    }
    let realisedRateToUsd: string | null = null;
    if (currency === 'RUB') {
      if (r.usdRub === null || !new D(r.usdRub).gt(0)) {
        problems.push(`Row ${r.line}: a RUB inflow needs its USD/RUB rate`);
        continue;
      }
      realisedRateToUsd = new D(1).div(r.usdRub).toSignificantDigits(SIG).toFixed();
    }
    inflows.push({
      source: r.source,
      amount,
      currency,
      receivedOn: r.receivedOn,
      realisedRateToUsd,
    });
    const span = spans.get(r.source);
    spans.set(r.source, {
      first: span && span.first < r.receivedOn ? span.first : r.receivedOn,
      last: span && span.last > r.receivedOn ? span.last : r.receivedOn,
    });
  }
  if (problems.length > 0) return err(new ImportError(problems.join('\n')));
  return ok({ inflows, created, spans });
}
