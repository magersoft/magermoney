/**
 * The emoji a goal or an asset can be marked with. A grid rather than a text
 * field, as the profile disc's is: a phone keyboard hides emoji behind two
 * taps, and a free field invites a word the disc cannot hold.
 *
 * One list for both, because the two stand side by side on the Goals screen
 * and are the same kind of thing to a person — something wanted, something
 * owned. The API takes any single emoji, so this list can change without a
 * migration; a record keeps an emoji that later leaves it.
 */
export const MARK_EMOJI_CHOICES = [
  '🚗',
  '🏠',
  '✈️',
  '🏖️',
  '🏔️',
  '🎓',
  '💍',
  '👶',
  '🐶',
  '🛡️',
  '🏦',
  '📈',
  '🪙',
  '💎',
  '💻',
  '📱',
  '⌚',
  '🎸',
  '🚲',
  '🏍️',
  '⛵',
  '🛋️',
  '🖼️',
  '🎁',
] as const;
