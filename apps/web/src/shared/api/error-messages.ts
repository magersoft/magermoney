/**
 * One place that turns an API error code into the message the person reads.
 * The API already answers with a human-readable `message`, but it is written in
 * English for the log, not for the screen, so each code the UI can actually
 * provoke gets its own i18n key. Anything else falls back to the generic
 * message of the screen that asked.
 */

import { ApiError } from './client';

/** Codes from `apps/api/src/shared/errors` and `packages/domain`, in the order the spec lists them. */
const KEY_BY_CODE: Record<string, string> = {
  recorded_in_future: 'errors.recordedInFuture',
  recorded_before_previous: 'errors.recordedBeforePrevious',
  entry_not_latest: 'errors.entryNotLatest',
  entry_not_manual: 'errors.entryNotManual',
  transfer_not_latest: 'errors.transferNotLatest',
  INSUFFICIENT_FUNDS: 'errors.insufficientFunds',
  account_has_history: 'errors.accountHasHistory',
  account_has_transfers: 'errors.accountHasTransfers',
  accounts_immutable: 'errors.accountsImmutable',
  amount_received_required: 'errors.amountReceivedRequired',
  TRANSFER_INVALID: 'errors.transferInvalid',
  received_in_future: 'errors.receivedInFuture',
  credit_not_latest: 'errors.creditNotLatest',
  inflow_not_latest: 'errors.inflowNotLatest',
  credited_amount_required: 'errors.creditedAmountRequired',
  credited_mismatch: 'errors.creditedMismatch',
  non_positive_amount: 'errors.nonPositiveAmount',
  credited_without_account: 'errors.creditedWithoutAccount',
  active_period_invalid: 'errors.activePeriodInvalid',
  pay_days_invalid: 'errors.payDaysInvalid',
  rate_out_of_range: 'errors.rateOutOfRange',
  source_has_inflows: 'errors.sourceHasInflows',
  default_account_not_found: 'errors.defaultAccountNotFound',
  account_has_inflows: 'errors.accountHasInflows',
};

/** The i18n key for a failure, or `fallbackKey` when it is not one the UI has words for. */
export function errorKeyFor(e: unknown, fallbackKey: string): string {
  if (!(e instanceof ApiError)) return fallbackKey;
  return KEY_BY_CODE[e.code] ?? fallbackKey;
}
