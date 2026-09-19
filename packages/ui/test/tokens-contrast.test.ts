// @vitest-environment node
// This suite reads a file instead of mounting anything; under happy-dom
// `import.meta.url` is served over http and the lookup cannot resolve.
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

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
    expect(ratio('mm-light-accent-fill', 'mm-light-bg')).toBeLessThan(4.5);
    expect(ratio('mm-light-positive-fill', 'mm-light-bg')).toBeLessThan(4.5);
  });
});

/** A token declared as a bare number — the tint's lightness and chroma. */
const scalar = (name: string): number => {
  const match = css.match(new RegExp(`--${name}:\\s*([\\d.]+);`));
  if (!match) throw new Error(`--${name} is not declared as a number in tokens.css`);
  return Number(match[1]);
};

describe('the currency tint', () => {
  /*
   * An account card is filled by its currency, and the currency only picks a
   * hue. That is what makes this provable rather than spot-checked: walk the
   * whole wheel at the theme's fixed lightness and chroma, and no currency —
   * including one nobody has added yet — can produce a card ink fails on.
   */
  it.each(['light', 'dark'])('carries ink at AA on every hue, in %s', (theme) => {
    const lightness = scalar(`mm-${theme}-tint-l`);
    const chroma = scalar(`mm-${theme}-tint-c`);
    const ink = token(`mm-${theme}-ink`);
    const wheel = Array.from({ length: 360 }, (_, hue) => ({
      hue,
      ratio: Math.round(contrast(ink, [lightness, chroma, hue]) * 10) / 10,
    }));
    // Reported as the worst hue, so a failure says which currency colour broke.
    const worst = wheel.reduce((a, b) => (b.ratio < a.ratio ? b : a));
    expect(worst.ratio).toBeGreaterThanOrEqual(4.5);
  });

  /*
   * The sRGB cone narrows towards white, so a chroma chosen by eye is easily
   * one the browser has to map back — and mapping pulls far-apart hues onto the
   * same colour, which is how "one currency, one colour" would fail silently.
   */
  it.each(['light', 'dark'])('stays inside sRGB on every hue, in %s', (theme) => {
    const lightness = scalar(`mm-${theme}-tint-l`);
    const chroma = scalar(`mm-${theme}-tint-c`);
    const outside = Array.from({ length: 360 }, (_, hue) => hue).filter((hue) =>
      linearRgb([lightness, chroma, hue]).some((channel) => channel < -0.001 || channel > 1.001),
    );
    expect(outside).toEqual([]);
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
