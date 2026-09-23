import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_COLORWAYS,
  AVATAR_COLORS,
  AVATAR_EMOJI_MAX_CODEPOINTS,
  isAvatarEmoji,
} from '../src/index.js';

describe('avatar', () => {
  it('paints the disc from the card palette, so one contrast proof covers both', () => {
    expect(AVATAR_COLORS).toEqual(ACCOUNT_COLORWAYS);
  });

  it.each(['🦊', '🐻‍❄️', '👩🏽‍💻', '🇬🇪', '❤️', '👨‍👩‍👧‍👦'])('takes %s as one emoji', (emoji) => {
    expect(isAvatarEmoji(emoji)).toBe(true);
  });

  it.each([
    ['nothing', ''],
    ['a letter', 'A'],
    ['a digit', '7'],
    ['two emoji', '🦊🐻'],
    ['an emoji with a letter', '🦊a'],
    ['surrounding space', ' 🦊'],
  ])('refuses %s', (_label, value) => {
    expect(isAvatarEmoji(value)).toBe(false);
  });

  it('refuses a cluster longer than the column holds', () => {
    const long = `👨${'‍👩'.repeat(AVATAR_EMOJI_MAX_CODEPOINTS)}`;
    expect(isAvatarEmoji(long)).toBe(false);
  });
});
