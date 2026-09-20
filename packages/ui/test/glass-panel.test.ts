// @vitest-environment node
// Reads the stylesheets rather than mounting anything; see tokens-contrast.test.ts.
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  fillForHue,
  ACCOUNT_COLORWAY_FILLS,
  luminance,
  type CardFill,
} from '../src/components/account-card/palette';

/**
 * The glass the phone's navigation is cut from.
 *
 * A translucent panel has no background of its own: what its labels are read
 * against is the fill composited over whatever happens to be scrolling past
 * underneath. So the material is not a taste decision with a contrast check
 * bolted on afterwards — the alpha *is* the contrast decision, and this file is
 * where it is made. It reads the tokens out of `tokens.css` and composites them
 * over the two extremes the app can actually put under the bar: the darkest and
 * the lightest fill an account card can take, anywhere on the hue wheel.
 *
 * The result is the reason the tabs are set in ink. At any alpha that still
 * lets content through, `muted` and `accent` fall under AA over a saturated
 * card — the second test pins that down, so nobody restores the quieter labels
 * without this file going red.
 */
const css = readFileSync(
  fileURLToPath(new URL('../src/styles/tokens.css', import.meta.url)),
  'utf8',
);

const entry = readFileSync(
  fileURLToPath(new URL('../src/styles/index.css', import.meta.url)),
  'utf8',
);

type Oklch = readonly [l: number, c: number, h: number];

/** A token declared as a literal `oklch()`, with or without an alpha. */
const token = (name: string): { colour: Oklch; alpha: number } => {
  const match = css.match(
    new RegExp(
      `--${name}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\s*(?:/\\s*([\\d.]+))?\\)`,
    ),
  );
  if (!match) throw new Error(`--${name} is not declared as a literal oklch() in tokens.css`);
  return {
    colour: [Number(match[1]), Number(match[2]), Number(match[3])],
    alpha: match[4] === undefined ? 1 : Number(match[4]),
  };
};

/** oklch -> linear-light sRGB (Ottosson), the space WCAG measures in. */
const linearRgb = ([l, c, hDeg]: Oklch): [number, number, number] => {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const long = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const medium = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const short = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
  ];
};

const clamp = (channel: number) => Math.min(1, Math.max(0, channel));
const encode = (u: number) => (u <= 0.0031308 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055);
const decode = (s: number) => (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4);

/** Gamma-encoded sRGB — the space a browser composites a translucent fill in. */
const srgb = (colour: Oklch) =>
  linearRgb(colour).map((ch) => encode(clamp(ch))) as [number, number, number];

const relativeLuminance = ([r, g, b]: [number, number, number]) =>
  0.2126 * decode(r) + 0.7152 * decode(g) + 0.0722 * decode(b);

const ratio = (a: number, b: number) =>
  Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 10) / 10;

/** The panel's fill painted at its own alpha over whatever lies beneath it. */
const composite = (fill: string, backdrop: [number, number, number]) => {
  const { colour, alpha } = token(fill);
  const [r, g, b] = srgb(colour);
  return relativeLuminance([
    r * alpha + backdrop[0] * (1 - alpha),
    g * alpha + backdrop[1] * (1 - alpha),
    b * alpha + backdrop[2] * (1 - alpha),
  ]);
};

/*
 * Everything the app can put under the bar, at its two extremes. The card
 * fills are searched across the whole wheel rather than taken from the eight
 * named colorways, because a currency lands on a generated hue and the worst
 * case is usually one of those.
 */
const everyCardFill: readonly CardFill[] = [
  ...Object.values(ACCOUNT_COLORWAY_FILLS),
  ...Array.from({ length: 360 }, (_, hue) => fillForHue(hue)),
];
const extreme = (pick: (a: CardFill, b: CardFill) => CardFill) =>
  everyCardFill.reduce((a, b) => pick(a, b));
const asBackdrop = (fill: CardFill) => srgb([fill.l, fill.c, fill.h]);
const darkestCard = asBackdrop(extreme((a, b) => (luminance(b) < luminance(a) ? b : a)));
const lightestCard = asBackdrop(extreme((a, b) => (luminance(b) > luminance(a) ? b : a)));

const backdrops = {
  light: {
    /* A white card, the brightest surface the light theme has. */
    card: srgb([1, 0, 0]),
    darkestCard,
    lightestCard,
  },
  dark: {
    /* The dark canvas, the darkest thing in the app. */
    canvas: srgb(token('mm-dark-bg').colour),
    darkestCard,
    lightestCard,
  },
} as const;

const worstThroughGlass = (theme: 'light' | 'dark', text: string) =>
  Math.min(
    ...Object.values(backdrops[theme]).map((backdrop) =>
      ratio(
        relativeLuminance(srgb(token(text).colour)),
        composite(`mm-${theme}-glass-fill`, backdrop),
      ),
    ),
  );

describe('the navigation glass', () => {
  it.each(['light', 'dark'] as const)(
    'carries ink at AA through the %s fill, over anything the app can scroll under it',
    (theme) => {
      expect(worstThroughGlass(theme, `mm-${theme}-ink`)).toBeGreaterThanOrEqual(4.5);
    },
  );

  /*
   * The derivation shown failing, which is the only thing that makes the one
   * above a guarantee rather than a decoration: the quiet roles the bar used
   * before it was glass do NOT survive the composite. A panel opaque enough to
   * carry them is a panel nothing shows through, so the labels moved to ink and
   * the current tab is marked by an opaque capsule instead of a tint.
   */
  it.each(['light', 'dark'] as const)(
    'cannot carry the quiet roles through the %s fill, which is why the tabs are ink',
    (theme) => {
      expect(worstThroughGlass(theme, `mm-${theme}-muted`)).toBeLessThan(4.5);
      expect(worstThroughGlass(theme, `mm-${theme}-accent`)).toBeLessThan(4.5);
    },
  );

  /*
   * The capsule under the current tab is the answer to that: it is opaque, so
   * the accent is read against a surface the palette already proves, and the
   * one coloured thing in the bar stops depending on what is behind it.
   */
  it.each(['light', 'dark'] as const)('gives the current tab an opaque surface, in %s', (theme) => {
    expect(token(`mm-${theme}-glass-opaque`).alpha).toBe(1);
    expect(
      ratio(
        relativeLuminance(srgb(token(`mm-${theme}-accent`).colour)),
        relativeLuminance(srgb(token(`mm-${theme}-surface-raised`).colour)),
      ),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('lets real content through rather than being opaque with a blur on top', () => {
    for (const theme of ['light', 'dark'] as const)
      expect(token(`mm-${theme}-glass-fill`).alpha).toBeLessThanOrEqual(0.8);
  });
});

describe('the glass-panel material', () => {
  const utility = entry.match(/@utility glass-panel \{[\s\S]*?\n\}/)?.[0];

  it('is a utility in the design system, so a screen never spells the material out', () => {
    expect(utility).toBeDefined();
    expect(utility).toContain('background-color: var(--mm-glass-fill)');
    expect(utility).toContain('backdrop-filter: blur(var(--mm-glass-blur))');
    expect(utility).toContain('var(--mm-glass-edge)');
    expect(utility).toContain('box-shadow: var(--mm-glass-shadow)');
  });

  /*
   * Two ways the glass can be unavailable, and they are not the same one:
   * a browser without `backdrop-filter` would show the fill's alpha with
   * nothing blurred behind it, and a reader who has asked for less
   * transparency has a working blur and does not want it. Both land on the
   * opaque token.
   */
  it('falls back to an opaque fill where the blur cannot run', () => {
    expect(utility).toMatch(
      /@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\) \{\s*background-color: var\(--mm-glass-opaque\);/,
    );
  });

  it('falls back to an opaque fill where the reader has asked for less transparency', () => {
    const reduced = utility?.match(
      /@media \(prefers-reduced-transparency: reduce\) \{[\s\S]*?\n {2}\}/,
    )?.[0];
    expect(reduced).toContain('background-color: var(--mm-glass-opaque)');
    /*
     * The filter is switched off as a neutral *value*, never `none`:
     * `backdrop-filter` is a composed property, and the keyword drops every
     * other contributor to it rather than the blur alone. The neutral value
     * goes into the tokens rather than into a second declaration, because the
     * minifier rewrites `blur(0px)` to `blur()` while a custom property is
     * emitted verbatim.
     */
    expect(reduced).toContain('--mm-glass-blur: 0px');
    expect(reduced).toContain('--mm-glass-saturate: 100%');
    expect(utility).not.toContain('backdrop-filter: none');
  });

  it('flips the whole material with the theme, like every other token', () => {
    for (const role of ['glass-fill', 'glass-opaque', 'glass-edge', 'glass-shadow']) {
      expect(css).toContain(`--mm-light-${role}:`);
      expect(css).toContain(`--mm-dark-${role}:`);
      // Declared once as the default, and re-pointed in each of the two dark branches.
      expect(
        css.match(new RegExp(`--mm-${role}: var\\(--mm-(light|dark)-${role}\\)`, 'g')),
      ).toHaveLength(3);
    }
  });
});
