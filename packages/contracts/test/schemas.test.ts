import { describe, expect, it } from 'vitest';
import { DecimalString, ManualRateInputSchema, UpdateProfileInputSchema } from '../src/index.js';

describe('contracts', () => {
  it('accepts decimal strings and rejects numbers and junk', () => {
    expect(DecimalString.safeParse('24715.00').success).toBe(true);
    expect(DecimalString.safeParse('-0.5').success).toBe(true);
    expect(DecimalString.safeParse(1.5).success).toBe(false);
    expect(DecimalString.safeParse('1,5').success).toBe(false);
  });
  it('validates a manual rate', () => {
    expect(
      ManualRateInputSchema.safeParse({ base: 'RUB', date: '2026-09-10', value: '0.011855' })
        .success,
    ).toBe(true);
    expect(
      ManualRateInputSchema.safeParse({ base: 'RUB', date: '10.09.2026', value: '0.01' }).success,
    ).toBe(false);
  });
  it('validates profile updates', () => {
    expect(
      UpdateProfileInputSchema.safeParse({
        reportingCurrencies: ['USD', 'EUR'],
        defaultCurrency: 'EUR',
      }).success,
    ).toBe(true);
    expect(
      UpdateProfileInputSchema.safeParse({ reportingCurrencies: [], defaultCurrency: 'EUR' })
        .success,
    ).toBe(false);
    expect(
      UpdateProfileInputSchema.safeParse({ reportingCurrencies: ['USD'], defaultCurrency: 'EUR' })
        .success,
    ).toBe(false);
  });
});
