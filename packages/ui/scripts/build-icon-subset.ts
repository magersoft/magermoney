/**
 * Writes the two icon files the app ships: `src/icons/subset.json`, registered
 * at import time, and `src/icons/country-flags.json`, fetched on demand.
 *
 * The full collections are ~1.1MB of JSON between them. Subsetting at runtime
 * still ships all of it to the browser, so the subsets are built here,
 * committed, and the collections stay in devDependencies.
 *
 * The split is the point. Every account needs its currency mark the moment a
 * screen paints, and those are a couple of dozen icons. The 257 country flags
 * are ~200KB and are needed a beat later, or only once someone opens the
 * country picker — so they are their own chunk, loaded by `loadCountryFlags()`.
 *
 * Run `bun run icons:build` after changing FIAT_FLAG, CRYPTO_KNOWN or
 * COUNTRY_CODES.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { IconifyJSON } from '@iconify/types';
import { getIcons } from '@iconify/utils';
import { icons as circleFlags } from '@iconify-json/circle-flags';
import { icons as cryptocurrencyColor } from '@iconify-json/cryptocurrency-color';
import { CRYPTO_KNOWN, FIAT_FLAG } from '../src/components/currency-icon/resolve-icon';
import { COUNTRY_CODES } from '../src/components/currency-icon/countries';

function subset(collection: IconifyJSON, names: readonly string[]): IconifyJSON {
  const icons = getIcons(collection, [...names]);
  if (!icons) throw new Error(`no icons matched in ${collection.prefix}`);
  /*
   * `getIcons` drops what it cannot find instead of complaining, which would
   * turn a typo into a mark that silently falls back to initials in the app.
   */
  const missing = names.filter((n) => !(n in icons.icons) && !(n in (icons.aliases ?? {})));
  if (missing.length > 0)
    throw new Error(`${collection.prefix} has no icon for: ${missing.join(', ')}`);
  return icons;
}

function write(name: string, value: unknown, note: string): void {
  const target = fileURLToPath(new URL(`../src/icons/${name}`, import.meta.url));
  mkdirSync(fileURLToPath(new URL('../src/icons/', import.meta.url)), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
  console.log(`wrote ${target}: ${note}`);
}

const eager = {
  'circle-flags': subset(circleFlags, Object.values(FIAT_FLAG)),
  'cryptocurrency-color': subset(cryptocurrencyColor, [...CRYPTO_KNOWN]),
};
/*
 * Flags a currency already brings in are left out — the eager subset is always
 * registered first, and a second copy would be bytes that change nothing.
 */
const eagerFlags = new Set(Object.values(FIAT_FLAG));
const countryFlags = subset(
  circleFlags,
  COUNTRY_CODES.map((c) => c.toLowerCase()).filter((c) => !eagerFlags.has(c)),
);

write(
  'subset.json',
  eager,
  `${Object.keys(eager['circle-flags'].icons).length} currency flags, ` +
    `${Object.keys(eager['cryptocurrency-color'].icons).length} crypto marks`,
);
write(
  'country-flags.json',
  countryFlags,
  `${Object.keys(countryFlags.icons).length} country flags`,
);
