import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/shared/api/client.js';
import { errorKeyFor } from '../src/shared/api/error-messages.js';
import en from '../src/locales/en.json';
import ru from '../src/locales/ru.json';

const CODES = [
  'credit_not_latest',
  'inflow_not_latest',
  'credited_amount_required',
  'credited_mismatch',
  'received_in_future',
  'source_has_inflows',
  'default_account_not_found',
  'non_positive_amount',
  'credited_without_account',
  'active_period_invalid',
  'pay_days_invalid',
  'rate_out_of_range',
  'account_has_inflows',
];

describe('errorKeyFor — income codes', () => {
  it('has words of its own for every code the income screens can provoke, in both locales', () => {
    for (const code of CODES) {
      const key = errorKeyFor(new ApiError(400, code, 'x'), 'fallback');
      expect(key, code).not.toBe('fallback');
      const leaf = key.split('.')[1] as string;
      expect((ru.errors as Record<string, string>)[leaf], `ru ${key}`).toBeTruthy();
      expect((en.errors as Record<string, string>)[leaf], `en ${key}`).toBeTruthy();
    }
  });
});
