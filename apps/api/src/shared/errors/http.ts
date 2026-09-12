import {
  DomainError,
  RateMissingError,
  UnknownCurrencyError,
  CurrencyMismatchError,
  InvalidAmountError,
  InsufficientFundsError,
  TransferError,
} from '@magermoney/domain';
import type { ErrorDto } from '@magermoney/contracts';

export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND';
  constructor(readonly what: string) {
    super(`${what} not found`);
  }
}

export class UnauthorizedError extends Error {
  readonly code = 'UNAUTHORIZED';
  constructor() {
    super('Sign in required');
  }
}

export class ValidationError extends Error {
  readonly code = 'VALIDATION';
  constructor(message: string) {
    super(message);
  }
}

/** A request that is well-formed but no longer applies: the entry is not the latest, the account has transfers. */
export class ConflictError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export type AppError =
  DomainError | NotFoundError | UnauthorizedError | ValidationError | ConflictError;

export function toHttpError(e: AppError): {
  status: 400 | 401 | 404 | 409 | 422 | 500;
  body: ErrorDto;
} {
  if (e instanceof ConflictError)
    return { status: 409, body: { code: e.code, message: e.message } };
  if (e instanceof NotFoundError)
    return { status: 404, body: { code: e.code, message: e.message } };
  if (e instanceof UnauthorizedError)
    return { status: 401, body: { code: e.code, message: e.message } };
  if (e instanceof ValidationError)
    return { status: 400, body: { code: e.code, message: e.message } };
  if (e instanceof RateMissingError)
    return { status: 422, body: { code: e.code, message: e.message } };
  if (
    e instanceof UnknownCurrencyError ||
    e instanceof CurrencyMismatchError ||
    e instanceof InvalidAmountError ||
    e instanceof TransferError ||
    e instanceof InsufficientFundsError
  )
    return { status: 400, body: { code: e.code, message: e.message } };
  return { status: 500, body: { code: 'INTERNAL', message: 'Unexpected error' } };
}
