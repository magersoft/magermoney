import { describe, expect, it } from 'vitest';
import { iconLoaded } from '@iconify/vue';
import {
  CORE_FIAT_FLAG,
  COUNTRY_CODES,
  CRYPTO_KNOWN,
  fiatFlag,
  loadCountryFlags,
  resolveCurrencyIcon,
} from '../src/index.js';

/*
 * `src/index.ts` registers a subset of each Iconify collection rather than the
 * whole 1.1MB of JSON. That subset is built from the resolver's own tables, and
 * this is the test that keeps the two from drifting: everything the resolver can
 * name must be an icon that is actually registered.
 */
describe('registered icon subsets', () => {
  it('covers every fiat the entry bundle has to draw at once', () => {
    const missing = Object.keys(CORE_FIAT_FLAG).filter((code) => {
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

  /*
   * The country flags are the other half of the same promise, one chunk later:
   * every country the picker can offer has to be a flag that is really there,
   * or the form would list places whose mark falls back to a currency.
   */
  it('covers every offerable country once the flags are loaded', async () => {
    expect(iconLoaded('circle-flags:jm')).toBe(false);
    await loadCountryFlags();

    const missing = COUNTRY_CODES.filter(
      (code) => !iconLoaded(`circle-flags:${code.toLowerCase()}`),
    );
    expect(missing).toEqual([]);
  });

  /*
   * The rest of the catalogue derives its flag from the country its code starts
   * with, and those flags live in the lazy chunk. The promise is the same one
   * the country picker makes: a name the resolver produces is a flag that is
   * really there, one chunk later.
   */
  it('covers every other fiat flag once the chunk is loaded', async () => {
    await loadCountryFlags();
    const codes = ['COP', 'JPY', 'BHD', 'ANG', 'XCG', 'NGN', 'KPW'];
    const missing = codes.filter((code) => {
      const resolved = resolveCurrencyIcon({ code, kind: 'fiat' });
      return resolved.kind !== 'iconify' || !iconLoaded(resolved.name);
    });
    expect(missing).toEqual([]);
  });

  it('shows initials for a currency no single country issues', () => {
    // The CFA francs and the East Caribbean dollar belong to a dozen countries
    // each; any flag would name the wrong one.
    for (const code of ['XAF', 'XOF', 'XPF', 'XCD']) expect(fiatFlag(code), code).toBeUndefined();
    expect(resolveCurrencyIcon({ code: 'XOF', kind: 'fiat' })).toEqual({
      kind: 'initials',
      text: 'XO',
    });
  });

  it('does not register the rest of the collection', async () => {
    await loadCountryFlags();
    /* A language, not a place: circle-flags carries both and we ship only places. */
    expect(iconLoaded('circle-flags:eo')).toBe(false);
  });
});
