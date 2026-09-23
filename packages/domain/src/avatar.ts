import { ACCOUNT_COLORWAYS } from './account.js';

/**
 * The colours a profile disc can be painted in: the card palette, by name.
 *
 * Borrowed rather than chosen afresh because each card fill already carries the
 * ink that survives on it and a contrast test proving it, in both themes at
 * once (a card is the same colour on any screen). A second list would need a
 * second proof. Append-only for the same reason as the card list: the names are
 * mirrored by a check constraint on `profiles.avatar_color`.
 */
export const AVATAR_COLORS = ACCOUNT_COLORWAYS;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

/**
 * The longest emoji a profile keeps, in code points. A family or a skin-toned
 * profession is eleven; nothing a keyboard offers comes near sixteen, so a
 * longer value is a string that happens to start with an emoji, not an emoji.
 * The check constraint on `profiles.avatar_emoji` uses the same number.
 */
export const AVATAR_EMOJI_MAX_CODEPOINTS = 16;

const PICTOGRAPHIC = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/**
 * Exactly one emoji, however many code points it takes to draw — a flag, a
 * skin tone, a family joined by ZWJs are each one. What the disc shows in place
 * of an initial, so two of them, or an emoji with a letter beside it, would not
 * fit the disc and are refused.
 */
export function isAvatarEmoji(value: string): boolean {
  if ([...value].length > AVATAR_EMOJI_MAX_CODEPOINTS) return false;
  const clusters = [...graphemes.segment(value)];
  return clusters.length === 1 && PICTOGRAPHIC.test(value);
}
