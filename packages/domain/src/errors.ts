export abstract class DomainError extends Error {
  abstract readonly code: string;
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
export class UnknownCurrencyError extends DomainError {
  readonly code = 'UNKNOWN_CURRENCY';
  constructor(readonly currency: string) {
    super(`Unknown currency: ${currency}`);
  }
}
export class CurrencyMismatchError extends DomainError {
  readonly code = 'CURRENCY_MISMATCH';
  constructor(
    readonly left: string,
    readonly right: string,
  ) {
    super(`Currency mismatch: ${left} vs ${right}`);
  }
}
export class RateMissingError extends DomainError {
  readonly code = 'RATE_MISSING';
  constructor(
    readonly base: string,
    readonly quote: string,
    readonly date: string,
  ) {
    super(`No rate for ${base}/${quote} on ${date}`);
  }
}
export class InvalidAmountError extends DomainError {
  readonly code = 'INVALID_AMOUNT';
  constructor(readonly raw: string) {
    super(`Invalid amount: ${raw}`);
  }
}
export type TransferErrorReason = 'negative_fee' | 'non_positive_amount' | 'same_account';
export class TransferError extends DomainError {
  readonly code = 'TRANSFER_INVALID';
  constructor(readonly reason: TransferErrorReason) {
    super(`Transfer invalid: ${reason}`);
  }
}
export class InsufficientFundsError extends DomainError {
  readonly code = 'INSUFFICIENT_FUNDS';
  constructor(
    readonly account: string,
    readonly shortBy: string,
  ) {
    super(`Insufficient funds on ${account}: short by ${shortBy}`);
  }
}
export type InflowErrorReason =
  'non_positive_amount' | 'credited_amount_required' | 'credited_mismatch';
export class InflowError extends DomainError {
  readonly code = 'INFLOW_INVALID';
  constructor(readonly reason: InflowErrorReason) {
    super(`Inflow invalid: ${reason}`);
  }
}
