import { describe, expect, it } from 'vitest';
import { iconLoaded } from '@iconify/vue';
import { CRYPTO_KNOWN, FIAT_FLAG, resolveCurrencyIcon } from '../src/index.js';

/*
 * `src/index.ts` registers a subset of each Iconify collection rather than the
 * whole 1.1MB of JSON. That subset is built from the resolver's own tables, and
 * this is the test that keeps the two from drifting: everything the resolver can
 * name must be an icon that is actually registered.
 */
describe('registered icon subsets', () => {
  it('covers every fiat the resolver can name', () => {
    const missing = Object.keys(FIAT_FLAG).filter((code) => {
      const resolved = resolveCurrencyIcon({ code, kind: 'fiat' });
      return resolved.kind !== 'iconify' || !iconLoaded(resolved.name);
    });
    expect(missing).toEqual([]);
  });

  it('covers every crypto ticker the resolver can name', () => {
    const missing = [...CRYPTO_KNOWN].filter((ticker) => {
      const resolved = resolveCurrencyIcon({ code: ticker, kind: 'crypto' });
      return resolved.kind !== 'iconify' || !iconLoaded(resolved.name);
    });
    expect(missing).toEqual([]);
  });

  it('does not register the rest of the collections', () => {
    expect(iconLoaded('circle-flags:jm')).toBe(false);
  });
});
