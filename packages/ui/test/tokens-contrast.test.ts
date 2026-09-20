// @vitest-environment node
// This suite reads a file instead of mounting anything; under happy-dom
// `import.meta.url` is served over http and the lookup cannot resolve.
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  contrastOn,
  fillForHue,
  ACCOUNT_COLORWAYS,
  ACCOUNT_COLORWAY_FILLS,
  type CardFill,
} from '../src/components/account-card/palette';

/**
 * The palette is data, not code, so the guard reads the stylesheet itself: a
 * value edited in `tokens.css` is checked here, and nothing can pass by being
 * duplicated into the test.
 */
const css = readFileSync(
  fileURLToPath(new URL('../src/styles/tokens.css', import.meta.url)),
  'utf8',
);

type Oklch = readonly [l: number, c: number, h: number];

const token = (name: string): Oklch => {
  const match = css.match(
    new RegExp(`--${name}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)`),
  );
  if (!match) throw new Error(`--${name} is not declared as a literal oklch() in tokens.css`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

/**
 * oklch -> linear-light sRGB (Ottosson's matrices), the space WCAG measures in.
 * Unclamped: a channel outside 0..1 is a colour sRGB cannot show, which is a
 * thing the tint has to be checked for, not a rounding error to hide.
 */
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

const luminance = (colour: Oklch) => {
  const clamp = (channel: number) => Math.min(1, Math.max(0, channel));
  const [r, g, b] = linearRgb(colour);
  return 0.2126 * clamp(r) + 0.7152 * clamp(g) + 0.0722 * clamp(b);
};

const contrast = (a: Oklch, b: Oklch) => {
  const lighter = Math.max(luminance(a), luminance(b));
  const darker = Math.min(luminance(a), luminance(b));
  return (lighter + 0.05) / (darker + 0.05);
};

/** WCAG rounds to one decimal before comparing, so 4.49 is not 4.5. */
const ratio = (fg: string, bg: string) => Math.round(contrast(token(fg), token(bg)) * 10) / 10;

describe('palette contrast', () => {
  /*
   * Light text sits on the canvas, on a white card and on a beige chip; the one
   * that fails is the one that matters, so every surface is checked.
   */
  const lightSurfaces = ['mm-light-bg', 'mm-light-surface'];

  it.each(['ink', 'muted', 'accent', 'positive', 'negative', 'warning'])(
    'light %s clears AA on the canvas and on a card',
    (role) => {
      for (const surface of lightSurfaces) {
        expect(ratio(`mm-light-${role}`, surface)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  /*
   * Dark foregrounds are measured from the lightest surface they can land on —
   * a sheet — because that is where the margin is thinnest.
   */
  it.each(['ink', 'muted', 'accent', 'positive', 'negative', 'warning'])(
    'dark %s clears AA on a sheet, the lightest surface it can sit on',
    (role) => {
      expect(ratio(`mm-dark-${role}`, 'mm-dark-surface-raised')).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('line-strong clears 3:1 for non-text boundaries in both themes', () => {
    expect(ratio('mm-light-line-strong', 'mm-light-bg')).toBeGreaterThanOrEqual(3);
    expect(ratio('mm-light-line-strong', 'mm-light-surface')).toBeGreaterThanOrEqual(3);
    expect(ratio('mm-dark-line-strong', 'mm-dark-surface-raised')).toBeGreaterThanOrEqual(3);
  });

  it('a filled brand surface carries its own foreground', () => {
    expect(ratio('mm-light-accent-fg', 'mm-light-accent-fill')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('mm-dark-accent-fg', 'mm-dark-accent-fill')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('mm-light-ink', 'mm-light-positive-fill')).toBeGreaterThanOrEqual(4.5);
  });

  /*
   * The delta badge is the one place the palette is spent, and it is spent as a
   * fill in both directions. A pastel fill has no dark counterpart — it is the
   * same colour in both themes — so pairing it with `ink` would read at 1.6 in
   * dark. That is what the `*-fg` roles exist for, and what this pins down.
   */
  it.each(['positive', 'negative'])('the %s badge fill clears AA in both themes', (role) => {
    for (const theme of ['light', 'dark']) {
      expect(ratio(`mm-${theme}-${role}-fg`, `mm-${theme}-${role}-fill`)).toBeGreaterThanOrEqual(
        4.5,
      );
    }
    // The same fill in both themes, so the badge cannot drift between them.
    expect(token(`mm-light-${role}-fill`)).toEqual(token(`mm-dark-${role}-fill`));
  });

  /*
   * A chip is the one place the beige sunken surface carries type, and it is
   * darker than the card: on it the secondary roles fall to about 4.0, so the
   * rule a chip follows is that its words are ink and nothing else. The × is an
   * icon, not text, and takes the 3:1 that WCAG 1.4.11 asks of a control.
   * Selected, the chip is the brand fill and carries its own foreground, which
   * the test above measures.
   */
  it.each(['light', 'dark'])('an unselected chip carries ink at AA, in %s', (theme) => {
    expect(ratio(`mm-${theme}-ink`, `mm-${theme}-surface-sunken`)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(`mm-${theme}-muted`, `mm-${theme}-surface-sunken`)).toBeGreaterThanOrEqual(3);
  });

  /*
   * The brand blue and green are the reason the fill and the text roles are
   * separate tokens: as text they miss AA, which is what this pins down.
   */
  it('keeps the brand fills out of the text roles', () => {
    expect(token('mm-light-accent')).not.toEqual(token('mm-light-accent-fill'));
    expect(token('mm-light-positive')).not.toEqual(token('mm-light-positive-fill'));
    expect(token('mm-light-negative')).not.toEqual(token('mm-light-negative-fill'));
    expect(ratio('mm-light-accent-fill', 'mm-light-bg')).toBeLessThan(4.5);
    expect(ratio('mm-light-positive-fill', 'mm-light-bg')).toBeLessThan(4.5);
    expect(ratio('mm-light-negative-fill', 'mm-light-bg')).toBeLessThan(4.5);
  });
});

/** A token declared as a bare number — the tint's lightness and chroma. */
const scalar = (name: string): number => {
  const match = css.match(new RegExp(`--${name}:\\s*([\\d.]+);`));
  if (!match) throw new Error(`--${name} is not declared as a number in tokens.css`);
  return Number(match[1]);
};

/**
 * The card palette.
 *
 * A fill is no longer a hue handed to theme-fixed lightness and chroma, so one
 * proof no longer covers every colour by construction. It is replaced by two,
 * matching how the two kinds of colour are chosen: the eight named colorways
 * are design decisions and each is checked, while the colour a currency lands
 * on is a rule applied to a hue and is checked across the whole wheel.
 *
 * Both are measured through the sheen rather than on the bare fill. The sheen
 * lies between the fill and the ink, so it is part of what the ink is read
 * against — and measuring the fill alone is exactly how a previous version of
 * this file passed while a card carried text at 3.7:1.
 */
describe('the card palette', () => {
  const encode = (u: number) => (u <= 0.0031308 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055);
  const decode = (s: number) => (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4);

  const sweep = scalar('mm-gloss-sweep');
  const bloom = scalar('mm-gloss-bloom');
  const shade = scalar('mm-gloss-shade');

  /** The fill with each sheen layer painted over it, in gamma-encoded sRGB. */
  const through = (
    fill: CardFill,
    layers: readonly (readonly [value: number, alpha: number])[],
  ) => {
    let channels = linearRgb([fill.l, fill.c, fill.h]).map((ch) =>
      encode(Math.min(1, Math.max(0, ch))),
    );
    for (const [value, alpha] of layers)
      channels = channels.map((ch) => ch * (1 - alpha) + value * alpha);
    const [r, g, b] = channels.map(decode) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  /*
   * The two corners where the sheen is strongest: the top-left, where the
   * bloom and the sweep stack into the lightest point a card has, and the foot,
   * where the shading makes the darkest. The bloom is under the sweep in the
   * stack, so it is painted on first.
   */
  const worstThroughGloss = (fill: CardFill) =>
    Math.min(
      contrastOn(
        fill.ink,
        through(fill, [
          [1, bloom],
          [1, sweep],
        ]),
      ),
      contrastOn(fill.ink, through(fill, [[0, shade]])),
    );

  it.each(ACCOUNT_COLORWAYS)('carries its ink at AA through the sheen: %s', (name) => {
    expect(worstThroughGloss(ACCOUNT_COLORWAY_FILLS[name])).toBeGreaterThanOrEqual(4.5);
  });

  it('carries ink at AA on every hue a currency can land on', () => {
    const worst = Array.from({ length: 360 }, (_, hue) => ({
      hue,
      ratio: worstThroughGloss(fillForHue(hue)),
    })).reduce((a, b) => (b.ratio < a.ratio ? b : a));
    expect(worst.ratio).toBeGreaterThanOrEqual(4.5);
  });

  /*
   * The point of the change: the palette is saturated. A fill that drifted back
   * towards pastel would still pass every contrast check above — contrast is
   * exactly what pastel is good at — so vividness needs a floor of its own.
   */
  it('stays vivid on every hue rather than drifting back to pastel', () => {
    /*
     * The floor is what the narrowest part of the wheel can hold — the teals,
     * whose gamut is thin — not a round number. The old pastel fill sat at
     * 0.06 with a lightness of 0.86; nothing here can get back there.
     */
    const chromas = Array.from({ length: 360 }, (_, hue) => fillForHue(hue).c);
    expect(Math.min(...chromas)).toBeGreaterThanOrEqual(0.08);
    for (const name of ACCOUNT_COLORWAYS)
      expect(ACCOUNT_COLORWAY_FILLS[name].c).toBeGreaterThanOrEqual(0.08);
  });

  /* Every fill must be a colour sRGB can actually show, or the browser maps it. */
  it('keeps every fill inside sRGB', () => {
    const outside = Array.from({ length: 360 }, (_, hue) => fillForHue(hue)).filter((f) =>
      linearRgb([f.l, f.c, f.h]).some((ch) => ch < -0.001 || ch > 1.001),
    );
    expect(outside).toEqual([]);
  });
});
describe('the donut segment palette', () => {
  /*
   * The one chart in the app, and the same proof the card tint gets: a segment
   * picks a hue and nothing else, so walking the wheel at the theme's fixed
   * lightness and chroma covers every category anybody will ever add.
   *
   * An arc is a graphic that carries meaning, so the bar is 1.4.11's 3:1 — and
   * it has to clear it on every surface a chart can be laid on, the sunken one
   * included, because that is where the legend's dot sits.
   */
  it.each([
    ['light', ['mm-light-surface', 'mm-light-bg', 'mm-light-surface-sunken']],
    ['dark', ['mm-dark-surface', 'mm-dark-bg', 'mm-dark-surface-sunken', 'mm-dark-surface-raised']],
  ] as const)('separates an arc from every %s surface at 3:1', (theme, surfaces) => {
    const lightness = scalar(`mm-${theme}-segment-l`);
    const chroma = scalar(`mm-${theme}-segment-c`);
    const worst = surfaces
      .flatMap((surface) =>
        Array.from({ length: 360 }, (_, hue) => ({
          hue,
          surface,
          ratio: Math.round(contrast(token(surface), [lightness, chroma, hue]) * 10) / 10,
        })),
      )
      .reduce((a, b) => (b.ratio < a.ratio ? b : a));
    expect(worst.ratio).toBeGreaterThanOrEqual(3);
  });

  it.each(['light', 'dark'])('stays inside sRGB on every hue, in %s', (theme) => {
    const lightness = scalar(`mm-${theme}-segment-l`);
    const chroma = scalar(`mm-${theme}-segment-c`);
    const outside = Array.from({ length: 360 }, (_, hue) => hue).filter((hue) =>
      linearRgb([lightness, chroma, hue]).some((channel) => channel < -0.001 || channel > 1.001),
    );
    expect(outside).toEqual([]);
  });

  /*
   * A segment is never labelled in its own colour: the legend sets the category
   * and its amount in ink on the sunken chip, which is what keeps the labels at
   * AA whatever hue the arc beside them turned out to be.
   */
  it.each(['light', 'dark'])('labels a segment in ink, which clears AA in %s', (theme) => {
    expect(ratio(`mm-${theme}-ink`, `mm-${theme}-surface-sunken`)).toBeGreaterThanOrEqual(4.5);
  });
});

/** The `--mm-*` assignments inside one rule, as `name -> value` pairs. */
const assignmentsIn = (selector: string) => {
  const block = css.slice(css.indexOf(selector) + selector.length);
  const body = block.slice(0, block.indexOf('}'));
  return Object.fromEntries(
    [...body.matchAll(/(--mm-[\w-]+):\s*var\((--mm-[\w-]+)\)/g)].map((m) => [m[1], m[2]]),
  );
};

describe('theme wiring', () => {
  /*
   * The two dark branches are written out twice — once for the system
   * preference, once for the explicit choice — and a token added to one and
   * forgotten in the other is exactly how a theme drifts.
   */
  it('points both dark branches at the same palette', () => {
    const preference = assignmentsIn(":root:not([data-theme='light'])");
    const pinned = assignmentsIn(":root[data-theme='dark']");
    expect(pinned).toEqual(preference);
    expect(Object.keys(pinned).length).toBeGreaterThan(0);
  });

  it('gives every light role a dark counterpart', () => {
    const roles = (theme: string) =>
      [...css.matchAll(new RegExp(`--mm-${theme}-([\\w-]+):`, 'g'))].map((m) => m[1]).sort();
    expect(roles('dark')).toEqual(roles('light'));
  });

  it('resolves each theme role to a declared palette value', () => {
    const pinned = assignmentsIn(":root[data-theme='dark']");
    for (const [role, source] of Object.entries(pinned)) {
      expect(source).toBe(role.replace('--mm-', '--mm-dark-'));
      expect(css).toContain(`${source}:`);
    }
  });
});
