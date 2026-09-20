/**
 * The colours an account can be painted in, as data.
 *
 * A colorway is a hue and nothing else — the same shape `currency-tint.ts`
 * hands in, and deliberately so. Lightness and chroma stay the theme's
 * (`--mm-tint-l` / `--mm-tint-c`), which is what keeps ink above AA on every
 * fill the wheel can produce: the proof in `test/tokens-contrast.test.ts` walks
 * all 360°, so a colorway cannot fall outside it and no colour has to be
 * checked by hand. It also means a painted card retints with the theme rather
 * than staying a light card on a dark screen.
 *
 * The hues are spread far enough apart to be told from each other at a glance
 * on a stack, which is the only thing they have to do: the colour groups and
 * helps you find a card again, while the name and the currency mark say which
 * account it is (`currency-tint.ts`).
 *
 * The names are the canonical list in `packages/domain/src/account.ts`, written
 * out again because the design system depends on Vue and Tailwind and nothing
 * else. The app holds the two together (`accounts/domain/colorway.test.ts`), so
 * a name added there and forgotten here fails a test rather than a card.
 */
import { currencyHue } from './currency-tint';

/** Degrees on the OKLCH wheel. Named, because a name survives a theme change and a number does not. */
export const ACCOUNT_COLORWAY_HUES = {
  slate: 250,
  ocean: 220,
  violet: 300,
  rose: 350,
  amber: 65,
  lime: 130,
  teal: 180,
} as const;

export type AccountColorway = keyof typeof ACCOUNT_COLORWAY_HUES;

/** The colours, in the order a picker deals them. */
export const ACCOUNT_COLORWAYS = Object.keys(ACCOUNT_COLORWAY_HUES) as readonly AccountColorway[];

/**
 * The hue a card is drawn in: the colorway the owner picked, or — for an
 * account that was never painted — the colour of what it holds, which is the
 * colour every account had before the choice existed.
 *
 * A name that is not a colorway falls back the same way, so a card painted in a
 * colour this build does not know still renders.
 */
export function cardHue(code: string, colorway?: string | null): number {
  const hue = colorway ? ACCOUNT_COLORWAY_HUES[colorway as AccountColorway] : undefined;
  return hue ?? currencyHue(code);
}

/**
 * What a card puts in its `style`. The fill itself is written in CSS from the
 * theme's lightness and chroma plus this hue, so the card retints with the
 * theme without re-rendering.
 */
export function cardTintStyle(code: string, colorway?: string | null): Record<string, string> {
  return { '--mm-card-hue': `${cardHue(code, colorway)}` };
}
