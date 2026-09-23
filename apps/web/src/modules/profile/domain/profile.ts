import type { ProfileDto } from '@magermoney/contracts';

/** The languages the interface is translated into. */
export const LOCALES = ['ru', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * How the person is addressed. The display name if they gave one, otherwise the
 * local part of their e-mail: a greeting that reads as a name, without storing
 * one that was never offered.
 */
export function greetingName(profile: ProfileDto | undefined, email: string | null): string {
  const name = profile?.displayName?.trim();
  if (name) return name;
  const local = email?.split('@')[0]?.trim();
  return local && local.length > 0 ? local : '';
}

/**
 * The default currency has to stay inside the reporting list; the API rejects
 * a pair that does not, so the editor moves it rather than letting the person
 * save something that will bounce.
 */
export function withoutCurrency(
  reporting: readonly string[],
  defaultCurrency: string,
  removed: string,
): { reportingCurrencies: string[]; defaultCurrency: string } | null {
  const next = reporting.filter((c) => c !== removed);
  if (next.length === 0) return null;
  return {
    reportingCurrencies: next,
    defaultCurrency: next.includes(defaultCurrency) ? defaultCurrency : (next[0] as string),
  };
}

/** What the profile disc draws: the chosen emoji, an initial, or a silhouette. */
export type AvatarFace = { kind: 'emoji' | 'initial'; glyph: string } | { kind: 'silhouette' };

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/**
 * The emoji the person picked wins. Without one, the first letter of whatever
 * the greeting calls them — by grapheme, so «Ярослав» and a name that starts
 * with a ZWJ emoji both come out whole. The silhouette is only what is left when
 * there is no name and no e-mail to take a letter from.
 */
export function avatarFace(profile: ProfileDto | undefined, email: string | null): AvatarFace {
  if (profile?.avatarEmoji) return { kind: 'emoji', glyph: profile.avatarEmoji };
  const first = graphemes.segment(greetingName(profile, email))[Symbol.iterator]().next();
  return first.done
    ? { kind: 'silhouette' }
    : { kind: 'initial', glyph: first.value.segment.toUpperCase() };
}

/**
 * The emoji the picker deals. A grid rather than a text field: a phone keyboard
 * hides emoji behind two taps, and a free field invites a word the disc cannot
 * hold. The API takes any single emoji, so this list can change without a
 * migration — a profile keeps an emoji that later leaves it.
 */
export const AVATAR_EMOJI_CHOICES = [
  '🦊',
  '🐻',
  '🐼',
  '🐨',
  '🐯',
  '🦁',
  '🐸',
  '🐙',
  '🦉',
  '🐧',
  '🦄',
  '🐝',
  '🌵',
  '🌻',
  '🍀',
  '🌊',
  '🔥',
  '⭐',
  '🌙',
  '☀️',
  '🚀',
  '🎧',
  '🎨',
  '☕',
] as const;
