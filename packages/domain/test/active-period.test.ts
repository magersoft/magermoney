import { describe, expect, it } from 'vitest';
import { isActiveOn, isActiveWithin } from '../src/index.js';

const open = { activeFrom: '2026-03-10', activeTo: null };
const closed = { activeFrom: '2026-03-10', activeTo: '2026-06-20' };

describe('isActiveOn', () => {
  it('starts on activeFrom and never ends while activeTo is null', () => {
    expect(isActiveOn(open, '2026-03-09')).toBe(false);
    expect(isActiveOn(open, '2026-03-10')).toBe(true);
    expect(isActiveOn(open, '2031-01-01')).toBe(true);
  });
  it('includes activeTo itself and nothing after it', () => {
    expect(isActiveOn(closed, '2026-06-20')).toBe(true);
    expect(isActiveOn(closed, '2026-06-21')).toBe(false);
  });
});

describe('isActiveWithin', () => {
  it('is true when the period overlaps the range on at least one day', () => {
    expect(isActiveWithin(closed, '2026-03-01', '2026-03-10')).toBe(true);
    expect(isActiveWithin(closed, '2026-06-20', '2026-06-30')).toBe(true);
    expect(isActiveWithin(open, '2030-01-01', '2030-01-31')).toBe(true);
  });
  it('is false when the range ends before the period or starts after it', () => {
    expect(isActiveWithin(closed, '2026-02-01', '2026-03-09')).toBe(false);
    expect(isActiveWithin(closed, '2026-06-21', '2026-07-31')).toBe(false);
  });
});
