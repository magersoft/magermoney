import { describe, expect, it } from 'vitest';
import { NAV, PILL_NAV } from '../src/shared/layout/nav.js';
import ru from '../src/locales/ru.json';
import en from '../src/locales/en.json';

/**
 * The pill's geometry, checked as arithmetic rather than by eye.
 *
 * At 320 px the pill is the viewport less the nav's own `px-4` on each side,
 * and inside it `px-2` plus the 56 px disc and its `mx-1`. Whatever is left is
 * shared by the tabs, and a label has to fit its share at the 10 px the
 * `text-2xs` token sets — measured generously at 0.62em per character, which is
 * wider than Instrument Sans runs for lower-case Cyrillic and Latin.
 */
const VIEWPORT = 320;
const NAV_PADDING = 16 * 2;
const PILL_PADDING = 8 * 2;
const DISC = 56 + 4 * 2;
const FONT_PX = 10;
const EM_PER_CHAR = 0.62;

const shareOf = (tabs: number) => (VIEWPORT - NAV_PADDING - PILL_PADDING - DISC) / tabs;

describe('the pill at 320 px', () => {
  it('keeps the "+" in the middle, with the same number of tabs on each side', () => {
    expect(PILL_NAV).toHaveLength(4);
    // BottomNav inserts the disc before index 2.
    expect(PILL_NAV.length - 2).toBe(2);
  });

  it('gives every label room at the narrowest phone, in both languages', () => {
    const share = shareOf(PILL_NAV.length);
    for (const item of PILL_NAV) {
      for (const [lang, dict] of [
        ['ru', ru],
        ['en', en],
      ] as const) {
        const key = item.label.split('.')[1]!;
        const label = (dict.nav as Record<string, string>)[key]!;
        const width = label.length * FONT_PX * EM_PER_CHAR;
        expect(
          width,
          `${lang}: "${label}" needs ${width.toFixed(0)}px of ${share.toFixed(0)}px`,
        ).toBeLessThanOrEqual(share);
      }
    }
  });

  it('would not have fitted with the settings tab still in the pill', () => {
    // The regression this layout exists to prevent, stated as the number.
    const share = shareOf(NAV.length);
    const longest = Math.max(
      ...NAV.map((i) => (ru.nav as Record<string, string>)[i.label.split('.')[1]!]!.length),
    );
    expect(longest * FONT_PX * EM_PER_CHAR).toBeGreaterThan(share);
  });
});
