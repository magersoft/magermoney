import { describe, expect, it } from 'vitest';
import { payDaysLabel } from '../src/modules/income/domain/labels.js';

describe('payDaysLabel', () => {
  it('lists the days in order', () => {
    expect(payDaysLabel([25, 10])).toBe('10, 25');
    expect(payDaysLabel([5])).toBe('5');
  });
  it('is empty for an irregular source, so the screen can say so in words', () => {
    expect(payDaysLabel([])).toBe('');
  });
});
