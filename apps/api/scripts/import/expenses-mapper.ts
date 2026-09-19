import { err, ok, type Result } from 'neverthrow';
import { Decimal } from '@magermoney/domain';
import { ImportError } from './accounts-mapper.js';
import { cellOf, findBlock } from './block.js';
import { pickNative, SHEET_CURRENCIES, type NativeOptions } from './native-currency.js';
import { parseRuNumber } from './numbers.js';

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
/** The sheet only has USD, EUR and RUB columns, and all three have two decimals. */
const SCALE = 2;

export const SUBSCRIPTIONS_CATEGORY = 'Подписки';
export const OTHER_CATEGORY = 'Прочее';

export interface MappedExpense {
  name: string;
  category: string;
  currency: string;
  /** Per `period`: the monthly amount, or the rebuilt yearly one. */
  amount: string;
  period: 'monthly' | 'yearly';
  ambiguous: boolean;
  /** True when the yearly amount was rebuilt from a rounded monthly figure. */
  approx: boolean;
}

export interface MappedBudget {
  name: string;
  currency: string;
  monthlyLimit: string;
  ambiguous: boolean;
}

export interface MappedExpenses {
  /** Categories the expenses use, in order of first appearance. */
  categories: string[];
  expenses: MappedExpense[];
  budgets: MappedBudget[];
}

export type ExpenseMapOptions = NativeOptions & {
  known: ReadonlySet<string>;
  /** `--as-budget`: sheet names (whitespace-normalised) imported as Budgets instead. */
  asBudget: ReadonlySet<string>;
};

const YEARLY = /\s*\(year[^)]*\)?/i;
const SUBSCRIPTION = /^Подписка\s+/i;

/**
 * The expenses sheet keeps the fixed obligations in its first four columns and
 * wish lists to the right. Only the first block counts, from the header row
 * "Позиция" to the row "Итого"; "Минимум" below it is never reached. The sheet
 * has no category, period or billing day, so category and period come from the
 * name and the rest is left for the person to fill in.
 */
export function mapExpenses(
  rows: string[][],
  opts: ExpenseMapOptions,
): Result<MappedExpenses, ImportError> {
  const found = findBlock(rows, 'Позиция');
  if (found.isErr()) return err(found.error);
  const block = found.value;
  const out: MappedExpenses = { categories: [], expenses: [], budgets: [] };
  const budgetsSeen = new Set<string>();
  // Every problem is collected so one dry run lists them all.
  const problems: string[] = [];
  let closed = false;
  for (let i = block.headerRow + 1; i < rows.length; i++) {
    const row = rows[i]!;
    const sheetName = cellOf(block, row, 'Позиция').replace(/\s+/g, ' ');
    if (sheetName === 'Итого') {
      closed = true;
      break;
    }
    if (sheetName === '') continue;
    const amounts = Object.fromEntries(
      SHEET_CURRENCIES.map((c) => [c, parseRuNumber(cellOf(block, row, c))]),
    );
    if (SHEET_CURRENCIES.every((c) => amounts[c] === null || amounts[c] === '0')) continue;
    const native = pickNative(sheetName, amounts, opts);
    if (native.isErr()) {
      problems.push(native.error.message);
      continue;
    }
    const { currency, amount, ambiguous } = native.value;
    if (!opts.known.has(currency)) {
      problems.push(
        `Row ${i + 1}: unknown currency ${currency}; add it to the currencies table first`,
      );
      continue;
    }
    if (amount.startsWith('-')) {
      problems.push(`Row ${i + 1}: "${sheetName}" has a negative amount`);
      continue;
    }
    if (opts.asBudget.has(sheetName)) {
      budgetsSeen.add(sheetName);
      out.budgets.push({ name: sheetName, currency, monthlyLimit: amount, ambiguous });
      continue;
    }
    const yearly = YEARLY.test(sheetName);
    const subscription = SUBSCRIPTION.test(sheetName);
    const name = sheetName.replace(YEARLY, '').replace(SUBSCRIPTION, '').trim();
    const category = subscription ? SUBSCRIPTIONS_CATEGORY : OTHER_CATEGORY;
    if (!out.categories.includes(category)) out.categories.push(category);
    out.expenses.push({
      name,
      category,
      currency,
      amount: yearly ? new D(amount).times(12).toDecimalPlaces(SCALE).toFixed() : amount,
      period: yearly ? 'yearly' : 'monthly',
      ambiguous,
      approx: yearly,
    });
  }
  if (!closed)
    return err(new ImportError('The expenses block has no "Итого" row; is this the right sheet?'));
  const unused = [...opts.asBudget].filter((n) => !budgetsSeen.has(n));
  if (unused.length > 0)
    problems.push(
      `--as-budget names no row in the sheet (rows whose amounts are all zero are skipped): ${unused.map((n) => `"${n}"`).join(', ')}`,
    );
  if (problems.length > 0) return err(new ImportError(problems.join('\n')));
  return ok(out);
}
