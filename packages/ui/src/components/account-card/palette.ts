/**
 * The colour of an account card, and the ink that survives on it.
 *
 * The first version of this fixed lightness and chroma in the theme and let a
 * currency pick only a hue. That is what made one contrast proof cover every
 * colour at once — but it also meant every card was a pastel, because a fill
 * pale enough for dark ink on *every* hue is pale on all of them.
 *
 * A card that looks like a bank card is saturated, and a saturated fill cannot
 * carry one fixed ink: white text dies on yellow, dark text dies on navy. So
 * ink stops being a property of the theme and becomes a property of the colour
 * — chosen with the fill, and proven with it.
 *
 * Both are also the same in light and dark. A red card is red on any screen,
 * the way a card in a wallet is; only the furniture around it (the shadow, the
 * hairline edge) still belongs to the theme.
 *
 * Two kinds of colour live here, and they earn their guarantees differently.
 * The named colorways are design decisions — eight hand-picked fills, each
 * carrying its own contrast test. The colour a currency gets is a rule applied
 * to a hue, so it is proven across all 360° instead, the way the pastel wheel
 * was (`test/tokens-contrast.test.ts`).
 */

/** Ink light enough for a deep fill, and ink dark enough for a light one. */
export const CARD_INK = {
  light: 'oklch(1 0 0)',
  dark: 'oklch(0.254 0.026 284)',
} as const;
export type CardInk = keyof typeof CARD_INK;

export interface CardFill {
  /** OKLCH lightness, 0–1. */
  l: number;
  /** OKLCH chroma. */
  c: number;
  /** OKLCH hue, degrees. */
  h: number;
  /** Which ink clears AA on this fill. */
  ink: CardInk;
}

/*
 * A card fill is never near-black or near-white: outside this band a colour
 * stops reading as a colour, and the gamut is so narrow there that a chroma
 * which is nominally huge is, in sRGB, a rounding error away from grey.
 */
const L_MIN = 0.42;
const L_MAX = 0.9;
const L_STEP = 0.005;

/**
 * The band of hues that has no good dark version. Darkening an orange or a
 * yellow does not deepen it, it turns it brown, so these take the light fill
 * with dark ink — which is what a yellow bank card actually looks like.
 * Every other hue goes deep and carries white, the way most cards do.
 *
 * It is a range of hues rather than a threshold on chroma, because chroma does
 * not tell the two cases apart: a deep teal is low-chroma and excellent, a deep
 * yellow is low-chroma and mud. Picking by number instead of by hue is how the
 * wheel ended up fluorescent in the greens while the hand-picked green next to
 * it was rich.
 */
const NO_DEEP_VERSION = { from: 40, to: 110 };

/**
 * The contrast a bare fill must carry, which is higher than the 4.5 the card
 * has to end up with. The sheen (`card-gloss`) lies between the fill and the
 * ink and spends some of it — a white highlight against white ink, the shading
 * at the foot against dark ink — so the fill is chosen with that spending
 * already budgeted, and the composited result is what the test checks. The
 * margin costs nothing in saturation: what binds at these hues is lightness,
 * not chroma.
 *
 * It is a budget, not a derivation — the sheen's own values live in CSS, and
 * duplicating them here would give the palette a second opinion about them. So
 * the number is set by whatever the composited test in
 * `test/tokens-contrast.test.ts` accepts, and that test, not this constant, is
 * what actually holds the line. Lowering the sheen lets this come down; raising
 * the sheen without raising this turns the test red, which is the point.
 */
const BARE_TARGET = 5.8;

/** OKLCH → linear sRGB (Ottosson). Unclamped: out-of-gamut must stay visible. */
function linearRgb({ l, c, h }: { l: number; c: number; h: number }): [number, number, number] {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const long = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const medium = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const short = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
  ];
}

const clamp = (channel: number) => Math.min(1, Math.max(0, channel));

/**
 * Inside sRGB. The tolerance is tight on purpose: a loose one passes colours
 * near black, where every channel is small enough that a wildly
 * out-of-gamut chroma still lands within it, and the search then happily
 * returns "vivid" colours that render as mud.
 */
const inGamut = (fill: { l: number; c: number; h: number }) =>
  linearRgb(fill).every((channel) => channel >= -0.0002 && channel <= 1.0002);

/** WCAG relative luminance. */
export function luminance(fill: { l: number; c: number; h: number }): number {
  const [r, g, b] = linearRgb(fill);
  return 0.2126 * clamp(r) + 0.7152 * clamp(g) + 0.0722 * clamp(b);
}

const INK_LUMINANCE: Record<CardInk, number> = {
  light: 1,
  dark: luminance({ l: 0.254, c: 0.026, h: 284 }),
};

/** Contrast of an ink against a background luminance, rounded the way WCAG compares. */
export function contrastOn(ink: CardInk, backgroundLuminance: number): number {
  const a = INK_LUMINANCE[ink];
  const lighter = Math.max(a, backgroundLuminance);
  const darker = Math.min(a, backgroundLuminance);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 10) / 10;
}

/** The most chroma sRGB can hold at this lightness and hue. */
function maxChroma(l: number, h: number): number {
  let lo = 0;
  let hi = 0.4;
  for (let i = 0; i < 30; i += 1) {
    const mid = (lo + hi) / 2;
    if (inGamut({ l, c: mid, h })) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** The most saturated fill at this hue that the given ink clears AA on. */
function richestFor(h: number, ink: CardInk): { l: number; c: number } | null {
  let best: { l: number; c: number } | null = null;
  for (let l = L_MIN; l <= L_MAX + 1e-9; l += L_STEP) {
    const c = maxChroma(l, h);
    if (contrastOn(ink, luminance({ l, c, h })) < BARE_TARGET) continue;
    if (!best || c > best.c) best = { l, c };
  }
  return best;
}

const wheel = new Map<number, CardFill>();

/**
 * The colour a hue gets when nobody picked one — the fill a currency lands on.
 *
 * Deep and white-inked wherever the hue has a rich dark version, because that
 * is what a card looks like; light and dark-inked where it has none, which is
 * the yellows and oranges. Either way the fill is the most saturated one its
 * ink clears AA on, so the whole wheel is vivid and the whole wheel is legible.
 */
export function fillForHue(hue: number): CardFill {
  const h = ((Math.round(hue) % 360) + 360) % 360;
  const cached = wheel.get(h);
  if (cached) return cached;

  const warm = h >= NO_DEEP_VERSION.from && h < NO_DEEP_VERSION.to;
  const deep = richestFor(h, 'light');
  const pale = richestFor(h, 'dark');
  /* Whichever the hue is due, the other stands in if it turns out impossible. */
  const first = warm ? pale : deep;
  const second = warm ? deep : pale;
  const ink: CardInk = first ? (warm ? 'dark' : 'light') : warm ? 'light' : 'dark';
  const fill = first ?? second;
  const pick: CardFill = fill
    ? { ...fill, h, ink }
    : /* Unreachable for any hue in sRGB; kept so the type is honest. */
      { l: 0.6, c: 0.1, h, ink: 'light' };
  wheel.set(h, pick);
  return pick;
}

/**
 * The colours an account can be painted in.
 *
 * Hand-picked rather than generated, because "looks like a bank card" is not a
 * maximum of anything: chasing the most chroma a hue can hold turns green and
 * cyan fluorescent, and a card is rich, not neon. Each one carries its own
 * contrast test, which is the price of choosing them by eye.
 *
 * The names are the canonical list in `packages/domain/src/account.ts`.
 */
export const ACCOUNT_COLORWAY_FILLS = {
  red: { l: 0.58, c: 0.238, h: 29, ink: 'light' }, //    #e60003
  orange: { l: 0.72, c: 0.19, h: 50, ink: 'dark' }, //   #fe7802
  amber: { l: 0.84, c: 0.172, h: 85, ink: 'dark' }, //   #fdc001
  green: { l: 0.5, c: 0.157, h: 145, ink: 'light' }, //  #01791e
  teal: { l: 0.51, c: 0.086, h: 200, ink: 'light' }, //  #037579
  blue: { l: 0.52, c: 0.171, h: 255, ink: 'light' }, //  #0067c8
  violet: { l: 0.55, c: 0.293, h: 300, ink: 'light' }, //#9202fd
  pink: { l: 0.58, c: 0.242, h: 350, ink: 'light' }, //  #d7008e
} as const satisfies Record<string, CardFill>;

export type AccountColorway = keyof typeof ACCOUNT_COLORWAY_FILLS;

/** The colours, in the order a picker deals them. */
export const ACCOUNT_COLORWAYS = Object.keys(ACCOUNT_COLORWAY_FILLS) as readonly AccountColorway[];

/**
 * The fill a card is drawn in: the colour the owner picked, or — for an account
 * that was never painted — the colour of what it holds.
 *
 * A name this build does not know falls back the same way, so a card painted in
 * a colour added after this client shipped still renders.
 */
export function cardFill(hue: number, colorway?: string | null): CardFill {
  const named = colorway ? ACCOUNT_COLORWAY_FILLS[colorway as AccountColorway] : undefined;
  return named ?? fillForHue(hue);
}

/**
 * What a card puts in its `style`: the fill's three coordinates and the ink
 * that goes on it. Written as custom properties rather than a finished colour
 * so the gloss, the edge and the focus ring can all read the same values.
 */
export function cardFillStyle(hue: number, colorway?: string | null): Record<string, string> {
  const fill = cardFill(hue, colorway);
  return {
    '--mm-card-l': `${fill.l}`,
    '--mm-card-c': `${fill.c}`,
    '--mm-card-hue': `${fill.h}`,
    '--mm-card-ink': CARD_INK[fill.ink],
  };
}
