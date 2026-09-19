import type Decimal from 'decimal.js';
import { err, ok, type Result } from 'neverthrow';
import type { Currency } from './currency.js';
import { InflowError, type CurrencyMismatchError } from './errors.js';
import type { Money } from './money.js';
import type { IsoDate } from './rate.js';
import { RATE_SIGNIFICANT_DIGITS } from './transfer.js';

/** An actual dated receipt of money from an Income source, optionally credited to an Account. */
export interface Inflow {
  id: string;
  incomeSourceId: string;
  amount: Money;
  receivedOn: IsoDate;
  /** The USD rate actually obtained that day; null = look it up in the rates table. */
  realisedRateToUsd: Decimal | null;
  accountId: string | null;
  /** What landed on the Account, in the Account's currency. Set exactly when `accountId` is. */
  creditedAmount: Money | null;
  note: string | null;
}

export interface InflowCredit {
  credited: Money;
  /** credited / amount when currencies differ; null for a same-currency credit. */
  realisedRate: Decimal | null;
}

/**
 * What an Inflow adds to the Account it is credited to. Same currency: the
 * Inflow amount itself. Another currency: both amounts are declared, like a
 * cross-currency Transfer, and the realised rate is derived — nothing is
 * converted automatically (ADR 0002).
 */
export function deriveInflowCredit(input: {
  amount: Money;
  accountCurrency: Currency;
  creditedAmount?: Money | undefined;
}): Result<InflowCredit, InflowError> {
  const { amount, accountCurrency, creditedAmount } = input;
  if (!amount.amount.gt(0)) return err(new InflowError('non_positive_amount'));
  if (creditedAmount && creditedAmount.currency.code !== accountCurrency.code)
    return err(new InflowError('credited_mismatch'));
  if (amount.currency.code === accountCurrency.code) {
    if (creditedAmount && !creditedAmount.amount.eq(amount.amount))
      return err(new InflowError('credited_mismatch'));
    return ok({ credited: amount, realisedRate: null });
  }
  if (!creditedAmount) return err(new InflowError('credited_amount_required'));
  if (!creditedAmount.amount.gt(0)) return err(new InflowError('non_positive_amount'));
  const realisedRate = creditedAmount.amount
    .div(amount.amount)
    .toSignificantDigits(RATE_SIGNIFICANT_DIGITS);
  return ok({ credited: creditedAmount, realisedRate });
}

/** The Account's new declared balance: the latest one plus what was credited. */
export function applyInflow(input: {
  balance: Money;
  credited: Money;
}): Result<Money, InflowError | CurrencyMismatchError> {
  if (!input.credited.amount.gt(0)) return err(new InflowError('non_positive_amount'));
  return input.balance.add(input.credited);
}
