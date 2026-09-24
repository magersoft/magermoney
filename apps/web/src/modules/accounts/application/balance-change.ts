import { Decimal } from '@magermoney/domain';

const AMOUNT = /^-?\d+(\.\d+)?$/;

/**
 * How far a balance typed in by hand moves the account: the typed amount minus
 * what was on it. Decimal, as every amount is (ADR 0001); `null` while there is
 * nothing to compare — no previous balance yet, or a half-typed number.
 */
export function balanceChange(before: string | null, after: string): string | null {
  if (before === null || !AMOUNT.test(before) || !AMOUNT.test(after)) return null;
  return new Decimal(after).minus(before).toFixed();
}
