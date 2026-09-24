import { describe, expect, it } from 'vitest';
import { balanceChange } from '../src/modules/accounts/application/balance-change.js';

describe('balanceChange', () => {
  it('is the exact decimal difference between what was on the account and what is typed', () => {
    expect(balanceChange('0.1', '0.3')).toBe('0.2');
    expect(balanceChange('10000', '9750.5')).toBe('-249.5');
  });

  it('has nothing to say before there is both a previous balance and a typed one', () => {
    expect(balanceChange(null, '5')).toBeNull();
    expect(balanceChange('5', '')).toBeNull();
    expect(balanceChange('5', '-')).toBeNull();
  });
});
