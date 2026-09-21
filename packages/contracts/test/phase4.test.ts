import { describe, expect, it } from 'vitest';
import {
  AssetInputSchema,
  GoalInputSchema,
  UpdateAccountInputSchema,
  ValuationInputSchema,
} from '../src/index.js';

describe('phase 4 contracts', () => {
  it('refuses a target that is not positive', () => {
    expect(
      GoalInputSchema.safeParse({ name: 'Car', targetAmount: '0', currency: 'EUR' }).success,
    ).toBe(false);
    expect(
      GoalInputSchema.safeParse({ name: 'Car', targetAmount: '-1', currency: 'EUR' }).success,
    ).toBe(false);
    expect(
      GoalInputSchema.safeParse({ name: 'Car', targetAmount: '10000.00', currency: 'EUR' }).success,
    ).toBe(true);
  });

  it('takes an optional target date and no status fields', () => {
    const parsed = GoalInputSchema.parse({
      name: 'Car',
      targetAmount: '1',
      currency: 'EUR',
      targetDate: '2027-03-01',
    });
    expect(parsed.targetDate).toBe('2027-03-01');
    expect('achievedAt' in parsed).toBe(false);
  });

  it('refuses a valuation that is not positive and requires its date', () => {
    expect(ValuationInputSchema.safeParse({ value: '-5' }).success).toBe(false);
    expect(ValuationInputSchema.safeParse({ value: '30000', valuedOn: '2026-09-01' }).success).toBe(
      true,
    );
  });

  it('defaults an asset out of the capital', () => {
    expect(AssetInputSchema.parse({ name: 'Car', currency: 'EUR' }).countsInTotal).toBe(false);
  });

  it('lets an account be linked to a goal or released from one', () => {
    expect(UpdateAccountInputSchema.parse({ goalId: null }).goalId).toBeNull();
    expect(UpdateAccountInputSchema.safeParse({ goalId: 'not-a-uuid' }).success).toBe(false);
  });
});
