import { describe, expect, it } from 'vitest';
import {
  AssetDtoSchema,
  AssetInputSchema,
  GoalDtoSchema,
  GoalInputSchema,
  UpdateAssetInputSchema,
  UpdateGoalInputSchema,
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

  describe('the mark of a goal and an asset', () => {
    const goal = { name: 'Car', targetAmount: '1', currency: 'EUR' };
    const asset = { name: 'Car', currency: 'EUR' };

    it('takes one emoji and a card-palette colour, on create and on edit', () => {
      for (const schema of [GoalInputSchema, AssetInputSchema]) {
        const base = schema === GoalInputSchema ? goal : asset;
        expect(schema.safeParse({ ...base, icon: '🚗', color: 'teal' }).success).toBe(true);
        expect(schema.safeParse({ ...base, icon: 'car' }).success).toBe(false);
        expect(schema.safeParse({ ...base, icon: '🚗🏠' }).success).toBe(false);
        expect(schema.safeParse({ ...base, color: '#ff0000' }).success).toBe(false);
      }
      for (const schema of [UpdateGoalInputSchema, UpdateAssetInputSchema]) {
        expect(schema.safeParse({ icon: null, color: null }).success).toBe(true);
        expect(schema.safeParse({ color: 'magenta' }).success).toBe(false);
      }
    });

    it('leaves both out of an input that does not name them', () => {
      const parsed = AssetInputSchema.parse(asset);
      expect(parsed).not.toHaveProperty('icon');
      expect(parsed).not.toHaveProperty('color');
    });

    it('reads a response that predates the fields as unmarked', () => {
      const goal = GoalDtoSchema.parse({
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Car',
        icon: null,
        targetAmount: '1',
        currency: 'EUR',
        targetDate: null,
        achievedAt: null,
        archivedAt: null,
        sortOrder: 0,
      });
      expect(goal.color).toBeNull();
      const asset = AssetDtoSchema.parse({
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Car',
        currency: 'EUR',
        countsInTotal: false,
        acquiredOn: null,
        purchasePrice: null,
        archivedAt: null,
        value: null,
        valuedOn: null,
      });
      expect(asset).toMatchObject({ icon: null, color: null });
    });

    it('reads a record that has neither', () => {
      const row = { icon: null, color: null };
      expect(
        GoalDtoSchema.safeParse({
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Car',
          targetAmount: '1',
          currency: 'EUR',
          targetDate: null,
          achievedAt: null,
          archivedAt: null,
          sortOrder: 0,
          ...row,
        }).success,
      ).toBe(true);
      expect(
        AssetDtoSchema.safeParse({
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Car',
          currency: 'EUR',
          countsInTotal: false,
          acquiredOn: null,
          purchasePrice: null,
          archivedAt: null,
          value: null,
          valuedOn: null,
          ...row,
        }).success,
      ).toBe(true);
    });
  });
});
