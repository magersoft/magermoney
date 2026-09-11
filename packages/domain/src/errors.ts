export abstract class DomainError extends Error {
  abstract readonly code: string;
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
export class UnknownCurrencyError extends DomainError {
  readonly code = 'UNKNOWN_CURRENCY';
  constructor(readonly currency: string) { super(`Unknown currency: ${currency}`); }
}
export class CurrencyMismatchError extends DomainError {
  readonly code = 'CURRENCY_MISMATCH';
  constructor(readonly left: string, readonly right: string) { super(`Currency mismatch: ${left} vs ${right}`); }
}
export class RateMissingError extends DomainError {
  readonly code = 'RATE_MISSING';
  constructor(readonly base: string, readonly quote: string, readonly date: string) {
    super(`No rate for ${base}/${quote} on ${date}`);
  }
}
export class InvalidAmountError extends DomainError {
  readonly code = 'INVALID_AMOUNT';
  constructor(readonly raw: string) { super(`Invalid amount: ${raw}`); }
}
