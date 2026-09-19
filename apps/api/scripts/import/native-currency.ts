import { err, ok, type Result } from 'neverthrow';
import { ImportError } from './accounts-mapper.js';

/** The three columns every sheet shows each amount in. */
export const SHEET_CURRENCIES = ['USD', 'EUR', 'RUB'] as const;

export interface NativeOptions {
  /** `--currency-of "<name>=<CODE>"`: sheet name → currency, wins over the guess. */
  currencyOf: ReadonlyMap<string, string>;
  /** `--fallback-currency`: used when the guess cannot decide. */
  fallback: string;
}

export interface NativePick {
  currency: string;
  amount: string;
  /** True when roundness could not decide and the fallback was taken. */
  ambiguous: boolean;
}

/** `parseRuNumber` drops an all-zero fraction, so a whole amount has no dot. */
export const isWhole = (n: string): boolean => !n.includes('.');

/** ["Deposit=RUB", "A=B=USD"] → Map { "Deposit" → "RUB", "A=B" → "USD" }. */
export function parseCurrencyOf(
  pairs: readonly string[],
): Result<Map<string, string>, ImportError> {
  const out = new Map<string, string>();
  for (const pair of pairs) {
    const at = pair.lastIndexOf('=');
    const name = at < 0 ? '' : pair.slice(0, at).trim();
    const code = at < 0 ? '' : pair.slice(at + 1).trim();
    if (name === '' || !/^[A-Z0-9]{2,10}$/.test(code))
      return err(new ImportError(`--currency-of expects "<name>=<CODE>", got "${pair}"`));
    out.set(name, code);
  }
  return ok(out);
}

/**
 * The sheet shows every amount in USD, EUR and RUB and never says which one the
 * person typed. People type round numbers, conversions are never round: the
 * currency whose amount has no fractional part is native when exactly one
 * qualifies. Otherwise the fallback is taken and the row is marked ambiguous so
 * the dry run can show it.
 */
export function pickNative(
  name: string,
  amounts: Readonly<Record<string, string | null | undefined>>,
  opts: NativeOptions,
): Result<NativePick, ImportError> {
  const override = opts.currencyOf.get(name);
  if (override !== undefined) {
    const amount = amounts[override];
    if (amount === null || amount === undefined)
      return err(
        new ImportError(
          `"${name}": --currency-of says ${override}, but the sheet has no ${override} amount for it`,
        ),
      );
    return ok({ currency: override, amount, ambiguous: false });
  }
  const whole = Object.entries(amounts).filter(
    (e): e is [string, string] => typeof e[1] === 'string' && e[1] !== '0' && isWhole(e[1]),
  );
  if (whole.length === 1)
    return ok({ currency: whole[0]![0], amount: whole[0]![1], ambiguous: false });
  const amount = amounts[opts.fallback];
  if (amount === null || amount === undefined)
    return err(
      new ImportError(
        `"${name}": cannot tell its currency and the sheet has no ${opts.fallback} amount; pass --currency-of "${name}=<CODE>"`,
      ),
    );
  return ok({ currency: opts.fallback, amount, ambiguous: true });
}
