/**
 * The colour of an account card, as data.
 *
 * The reference colours its cards; we colour ours by what they hold. A currency
 * therefore owns a hue, and only a hue: lightness and chroma are fixed by the
 * theme (`--mm-tint-l` / `--mm-tint-c` in `tokens.css`), which is what lets ink
 * clear AA on every fill the wheel can produce — proved across all 360° in
 * `test/tokens-contrast.test.ts` rather than spot-checked per currency.
 *
 * Two cards in the same currency are the same colour. That is the point: on a
 * screen of a dozen accounts the colour groups them by what they hold, and a
 * screen never picks a card colour by hand.
 *
 * The colour groups and helps you find a card again; it never identifies one on
 * its own. A wheel divided between nineteen currencies puts some pairs close
 * enough to argue about, so the name and the currency mark stay the answer to
 * "which account is this".
 */

/**
 * The currencies the app ships with, in the order `supabase/migrations`
 * seeds them. Hues are handed out by position, so this list is **append-only**:
 * inserting into the middle would recolour every card after it.
 *
 * A code outside the list still gets a hue, from the hash below. It just does
 * not get the guarantee that it sits far from its neighbours.
 */
export const CURRENCY_TINT_ORDER: readonly string[] = [
  'USD',
  'EUR',
  'RUB',
  'KZT',
  'UZS',
  'IDR',
  'EGP',
  'GEL',
  'KGS',
  'BTC',
  'ETH',
  'USDT',
  'XRP',
  'SOL',
  'DOGE',
  'PEPE',
  'AVAX',
  'ATOM',
  'TRX',
];

/**
 * The golden angle. Stepping the wheel by it spreads any number of currencies
 * about as far apart as they can go, and keeps doing so as the list grows —
 * unlike `index * (360 / n)`, which re-spaces everything whenever `n` changes.
 */
const GOLDEN_ANGLE = 137.508;

/** FNV-1a, so a currency outside the list still lands somewhere stable. */
function hash(code: string): number {
  let value = 2166136261;
  for (let i = 0; i < code.length; i += 1) {
    value ^= code.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/** The hue of a currency, in degrees. Deterministic, case-insensitive. */
export function currencyHue(code: string): number {
  const upper = code.toUpperCase();
  const index = CURRENCY_TINT_ORDER.indexOf(upper);
  const seed = index >= 0 ? index : hash(upper);
  return Math.round(((seed * GOLDEN_ANGLE) % 360) * 10) / 10;
}

/**
 * What a card puts in its `style`. The fill itself is written in CSS, from the
 * theme's lightness and chroma plus this hue, so the card retints with the
 * theme without re-rendering.
 */
export function currencyTintStyle(code: string): Record<string, string> {
  return { '--mm-card-hue': `${currencyHue(code)}` };
}
