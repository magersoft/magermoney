import { describe, expect, it } from 'vitest';
import type { ProfileDto } from '@magermoney/contracts';
import { isAvatarEmoji } from '@magermoney/domain';
import { AVATAR_EMOJI_CHOICES, avatarFace } from '../src/modules/profile/domain/profile.js';

const base: ProfileDto = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: null,
  locale: 'en',
  defaultCurrency: 'EUR',
  reportingCurrencies: ['EUR'],
  onboardingCompletedAt: null,
  avatarEmoji: null,
  avatarColor: null,
};

describe('avatarFace', () => {
  it('shows the chosen emoji, whatever the name', () => {
    expect(avatarFace({ ...base, displayName: 'Vlad', avatarEmoji: '🦊' }, null)).toEqual({
      kind: 'emoji',
      glyph: '🦊',
    });
  });

  it('falls back to the capitalised initial of the name when no emoji was chosen', () => {
    expect(avatarFace({ ...base, displayName: 'ярослав' }, null)).toEqual({
      kind: 'initial',
      glyph: 'Я',
    });
  });

  it('takes the initial from the e-mail when there is no name, the way the greeting does', () => {
    expect(avatarFace(base, 'vlad@example.com')).toEqual({ kind: 'initial', glyph: 'V' });
  });

  it('keeps an emoji at the start of a name whole', () => {
    expect(avatarFace({ ...base, displayName: '🐻‍❄️ Bear' }, null)).toEqual({
      kind: 'initial',
      glyph: '🐻‍❄️',
    });
  });

  it('is a silhouette when there is nothing to take a letter from', () => {
    expect(avatarFace(base, null)).toEqual({ kind: 'silhouette' });
    expect(avatarFace(undefined, null)).toEqual({ kind: 'silhouette' });
  });
});

describe('AVATAR_EMOJI_CHOICES', () => {
  it('deals only what the API will take, each once', () => {
    for (const emoji of AVATAR_EMOJI_CHOICES) expect(isAvatarEmoji(emoji)).toBe(true);
    expect(new Set(AVATAR_EMOJI_CHOICES).size).toBe(AVATAR_EMOJI_CHOICES.length);
  });
});
