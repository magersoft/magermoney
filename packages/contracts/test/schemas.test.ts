import { describe, expect, it } from 'vitest';
import {
  DecimalString,
  ManualRateInputSchema,
  ProfileDtoSchema,
  UpdateProfileInputSchema,
} from '../src/index.js';

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

  describe('the avatar', () => {
    it('is optional in an update, so a change to the name leaves it alone', () => {
      const parsed = UpdateProfileInputSchema.parse({ displayName: 'Vlad' });
      expect(parsed).not.toHaveProperty('avatarEmoji');
      expect(parsed).not.toHaveProperty('avatarColor');
    });
    it('takes one emoji and a palette colour, or null to go back to the default', () => {
      expect(
        UpdateProfileInputSchema.safeParse({ avatarEmoji: '🦊', avatarColor: 'teal' }).success,
      ).toBe(true);
      expect(
        UpdateProfileInputSchema.safeParse({ avatarEmoji: null, avatarColor: null }).success,
      ).toBe(true);
    });
    it.each([
      ['a colour outside the palette', { avatarColor: 'magenta' }],
      ['two emoji', { avatarEmoji: '🦊🐻' }],
      ['a letter', { avatarEmoji: 'V' }],
      ['an empty string', { avatarEmoji: '' }],
    ])('refuses %s', (_label, input) => {
      expect(UpdateProfileInputSchema.safeParse(input).success).toBe(false);
    });
    it('is part of the profile, null when never chosen', () => {
      const dto = {
        id: '11111111-1111-4111-8111-111111111111',
        displayName: null,
        locale: 'en',
        defaultCurrency: 'USD',
        reportingCurrencies: ['USD'],
        onboardingCompletedAt: null,
        avatarEmoji: null,
        avatarColor: null,
      };
      expect(ProfileDtoSchema.safeParse(dto).success).toBe(true);
      expect(ProfileDtoSchema.safeParse({ ...dto, avatarEmoji: undefined }).success).toBe(false);
    });
  });
});
