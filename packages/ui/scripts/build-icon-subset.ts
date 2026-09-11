/**
 * Writes `src/icons/subset.json` — only the icons the resolver can name.
 *
 * The full collections are ~1.1MB of JSON between them. Subsetting at runtime
 * still ships all of it to the browser, so the subset is built here, committed,
 * and the collections stay in devDependencies.
 *
 * Run `bun run icons:build` after changing FIAT_FLAG or CRYPTO_KNOWN.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { IconifyJSON } from '@iconify/types';
import { getIcons } from '@iconify/utils';
import { icons as circleFlags } from '@iconify-json/circle-flags';
import { icons as cryptocurrencyColor } from '@iconify-json/cryptocurrency-color';
import { CRYPTO_KNOWN, FIAT_FLAG } from '../src/components/currency-icon/resolve-icon';

function subset(collection: IconifyJSON, names: readonly string[]): IconifyJSON {
  const icons = getIcons(collection, [...names]);
  if (!icons) throw new Error(`no icons matched in ${collection.prefix}`);
  return icons;
}

const out = {
  'circle-flags': subset(circleFlags, Object.values(FIAT_FLAG)),
  'cryptocurrency-color': subset(cryptocurrencyColor, [...CRYPTO_KNOWN]),
};

const target = fileURLToPath(new URL('../src/icons/subset.json', import.meta.url));
mkdirSync(fileURLToPath(new URL('../src/icons/', import.meta.url)), { recursive: true });
writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);
console.log(
  `wrote ${target}: ${Object.keys(out['circle-flags'].icons).length} flags, ` +
    `${Object.keys(out['cryptocurrency-color'].icons).length} crypto marks`,
);
