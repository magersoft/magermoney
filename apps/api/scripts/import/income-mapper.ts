import { err, ok, type Result } from 'neverthrow';
import { ImportError } from './accounts-mapper.js';
import { cellOf, findBlock } from './block.js';
import { pickNative, SHEET_CURRENCIES, type NativeOptions } from './native-currency.js';
import { parsePercent, parseRuNumber } from './numbers.js';

export interface MappedIncomeSource {
  name: string;
  currency: string;
  /** Monthly gross, in `currency`. */
  grossAmount: string;
  /** Fractions in [0, 1): "0.15" for 15 %. */
  taxRate: string;
  commissionRate: string;
  ambiguous: boolean;
}

export type IncomeMapOptions = NativeOptions & { known: ReadonlySet<string> };

/**
 * The income sheet stacks three tables (monthly, yearly, daily) under the same
 * header and keeps an hourly-rate calculator to the right. Only the first
 * table is data: from the header row "Источник" down to the first row without
 * a name. The "Месячный доход" total sits below that blank row and is never reached.
 */
export function mapIncomeSources(
  rows: string[][],
  opts: IncomeMapOptions,
): Result<MappedIncomeSource[], ImportError> {
  const found = findBlock(rows, 'Источник');
  if (found.isErr()) return err(found.error);
  const block = found.value;
  const out: MappedIncomeSource[] = [];
  const seen = new Set<string>();
  // Every problem is collected so one dry run lists them all.
  const problems: string[] = [];
  for (let i = block.headerRow + 1; i < rows.length; i++) {
    const row = rows[i]!;
    const name = cellOf(block, row, 'Источник').replace(/\s+/g, ' ');
    if (name === '') break;
    if (seen.has(name)) {
      problems.push(`Row ${i + 1}: income source "${name}" is listed twice`);
      continue;
    }
    seen.add(name);
    const amounts = Object.fromEntries(
      SHEET_CURRENCIES.map((c) => [c, parseRuNumber(cellOf(block, row, c))]),
    );
    const native = pickNative(name, amounts, opts);
    if (native.isErr()) {
      problems.push(native.error.message);
      continue;
    }
    if (!opts.known.has(native.value.currency)) {
      problems.push(
        `Row ${i + 1}: unknown currency ${native.value.currency}; add it to the currencies table first`,
      );
      continue;
    }
    if (native.value.amount.startsWith('-')) {
      problems.push(`Row ${i + 1}: "${name}" has a negative amount`);
      continue;
    }
    const taxRate = parsePercent(cellOf(block, row, 'Налоги'));
    // The sheet spells the header "Коммисии"; accept the dictionary spelling too.
    const commissionRate = parsePercent(
      cellOf(block, row, 'Коммисии') || cellOf(block, row, 'Комиссии'),
    );
    if (taxRate === null || commissionRate === null) {
      problems.push(`Row ${i + 1}: "${name}" has a tax or commission outside 0–99 %`);
      continue;
    }
    out.push({
      name,
      currency: native.value.currency,
      grossAmount: native.value.amount,
      taxRate,
      commissionRate,
      ambiguous: native.value.ambiguous,
    });
  }
  if (problems.length > 0) return err(new ImportError(problems.join('\n')));
  if (out.length === 0)
    return err(new ImportError('The income sheet has no sources under its header'));
  return ok(out);
}
