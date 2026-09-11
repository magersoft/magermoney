import Decimal from 'decimal.js';
import { err, ok, type Result } from 'neverthrow';
import { mayGoNegative, type Account } from './account.js';
import { CurrencyMismatchError, InsufficientFundsError, TransferError } from './errors.js';
import { Money } from './money.js';

/** Realised rates are quoted like the rates table: ten significant digits. */
export const RATE_SIGNIFICANT_DIGITS = 10;

export interface TransferDerivation {
  /** received / sent when currencies differ; null for a same-currency transfer. */
  realisedRate: Decimal | null;
  /** sent − received when currencies match; null when they differ (fee and spread cannot be separated). */
  fee: Money | null;
}

export function deriveTransfer(input: {
  amountSent: Money;
  amountReceived: Money;
}): Result<TransferDerivation, TransferError | CurrencyMismatchError> {
  const { amountSent, amountReceived } = input;
  if (!amountSent.amount.gt(0)) return err(new TransferError('non_positive_amount'));
  if (amountSent.currency.code === amountReceived.currency.code) {
    return amountSent
      .subtract(amountReceived)
      .andThen((fee) =>
        fee.isNegative() ? err(new TransferError('negative_fee')) : ok({ realisedRate: null, fee }),
      );
  }
  const rate = amountReceived.amount
    .div(amountSent.amount)
    .toSignificantDigits(RATE_SIGNIFICANT_DIGITS);
  return ok({ realisedRate: rate, fee: null });
}

export function applyTransfer(input: {
  from: Pick<Account, 'kind' | 'cardType'> & { balance: Money };
  toBalance: Money;
  amountSent: Money;
  amountReceived: Money;
}): Result<{ fromAfter: Money; toAfter: Money }, InsufficientFundsError | CurrencyMismatchError> {
  const { from, toBalance, amountSent, amountReceived } = input;
  return from.balance.subtract(amountSent).andThen((fromAfter) => {
    if (fromAfter.isNegative() && !mayGoNegative(from))
      return err(
        new InsufficientFundsError(from.balance.currency.code, fromAfter.amount.abs().toFixed()),
      );
    return toBalance.add(amountReceived).map((toAfter) => ({ fromAfter, toAfter }));
  });
}
