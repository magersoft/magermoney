import { describe, expect, it } from 'vitest';
import { ACCOUNT_COLORWAYS, MARK_COLORS, isMarkEmoji } from '../src/index.js';

describe('mark', () => {
  it('colours goals and assets from the card palette, so one contrast proof covers them', () => {
    expect(MARK_COLORS).toEqual(ACCOUNT_COLORWAYS);
  });

  it('takes one emoji, however many code points draw it, and nothing else', () => {
    expect(isMarkEmoji('🚗')).toBe(true);
    expect(isMarkEmoji('🏖️')).toBe(true);
    expect(isMarkEmoji('👨‍👩‍👧')).toBe(true);
    expect(isMarkEmoji('🚗🚗')).toBe(false);
    expect(isMarkEmoji('Car')).toBe(false);
    expect(isMarkEmoji('')).toBe(false);
  });
});
