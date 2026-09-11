import { describe, expect, it } from 'vitest';
import { RateMissingError, UnknownCurrencyError } from '@magermoney/domain';
import { NotFoundError, ValidationError, toHttpError } from '../src/shared/errors/http.js';

describe('toHttpError', () => {
  it('maps domain errors to statuses', () => {
    expect(toHttpError(new RateMissingError('KZT', 'USD', '2026-01-01')).status).toBe(422);
    expect(toHttpError(new UnknownCurrencyError('XYZ')).status).toBe(400);
    expect(toHttpError(new NotFoundError('profile'))).toEqual({ status: 404, body: { code: 'NOT_FOUND', message: 'profile not found' } });
  });
  it('maps ValidationError to 400', () => {
    expect(toHttpError(new ValidationError('x')).status).toBe(400);
  });
});
