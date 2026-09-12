import { describe, expect, it } from 'vitest';
import {
  InsufficientFundsError,
  RateMissingError,
  TransferError,
  UnknownCurrencyError,
} from '@magermoney/domain';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  toHttpError,
} from '../src/shared/errors/http.js';

describe('toHttpError', () => {
  it('maps domain errors to statuses', () => {
    expect(toHttpError(new RateMissingError('KZT', 'USD', '2026-01-01')).status).toBe(422);
    expect(toHttpError(new UnknownCurrencyError('XYZ')).status).toBe(400);
    expect(toHttpError(new NotFoundError('profile'))).toEqual({
      status: 404,
      body: { code: 'NOT_FOUND', message: 'profile not found' },
    });
  });
  it('maps ValidationError to 400', () => {
    expect(toHttpError(new ValidationError('x')).status).toBe(400);
  });

  it('maps conflicts to 409 with the given code, and transfer errors to 400', () => {
    expect(
      toHttpError(new ConflictError('entry_not_latest', 'Only the latest entry can change')),
    ).toEqual({
      status: 409,
      body: { code: 'entry_not_latest', message: 'Only the latest entry can change' },
    });
    expect(toHttpError(new TransferError('negative_fee')).status).toBe(400);
    expect(toHttpError(new InsufficientFundsError('USD', '1')).status).toBe(400);
  });
});
