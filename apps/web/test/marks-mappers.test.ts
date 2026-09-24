import { describe, expect, it } from 'vitest';
import { CurrencyRegistry } from '@magermoney/domain';
import { toAsset } from '../src/modules/assets/domain/mappers.js';
import { toGoal } from '../src/modules/goals/domain/mappers.js';

const registry = new CurrencyRegistry([{ code: 'USD', kind: 'fiat', scale: 2 }]);

const goalDto = (over: object = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Car',
  icon: null,
  color: null,
  targetAmount: '10000',
  currency: 'USD',
  targetDate: null,
  achievedAt: null,
  archivedAt: null,
  sortOrder: 0,
  ...over,
});
const assetDto = (over: object = {}) => ({
  id: '44444444-4444-4444-8444-444444444444',
  name: 'Watch',
  icon: null,
  color: null,
  currency: 'USD',
  countsInTotal: false,
  acquiredOn: null,
  purchasePrice: null,
  archivedAt: null,
  value: null,
  valuedOn: null,
  ...over,
});

describe('the mark, at the boundary', () => {
  it('carries an emoji and a colour through', () => {
    expect(toGoal(goalDto({ icon: '🚗', color: 'teal' }), registry)).toMatchObject({
      icon: '🚗',
      color: 'teal',
    });
    expect(toAsset(assetDto({ icon: '⌚', color: 'amber' }), registry)).toMatchObject({
      icon: '⌚',
      color: 'amber',
    });
  });

  /*
   * The API took any short string as a goal's icon before the emoji rule, and
   * the database only bounds new writes. A word would not fit the disc, so it
   * reads as no icon and the disc shows the initial instead.
   */
  it('reads an old icon that is not one emoji as none', () => {
    expect(toGoal(goalDto({ icon: 'car' }), registry).icon).toBeNull();
    expect(toGoal(goalDto({ icon: '🚗🚗' }), registry).icon).toBeNull();
  });
});
