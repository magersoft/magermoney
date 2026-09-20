import { describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { loadCountryFlags } from '../src/icons/country-flags.js';
import CurrencyIcon from '../src/components/currency-icon/CurrencyIcon.vue';
// The side effect that registers the icon subsets; without it the icon branch
// renders an empty placeholder.
import '../src/index.js';

/**
 * The drawing itself, without the label — the mark, not who it is announced as.
 * Iconify numbers the ids of a flag's own masks per render, so they are wiped;
 * what is left is the shape.
 */
const drawn = (w: ReturnType<typeof mount>) =>
  w.find('svg').element.innerHTML.replace(/SVG[A-Za-z0-9]+/g, 'id');
/** The same component asked for one icon by name, as the answer to compare against. */
async function namedDrawing(icon: string): Promise<string> {
  const w = mount(CurrencyIcon, { props: { code: 'ZZZ', kind: 'fiat', icon } });
  await flushPromises();
  return drawn(w);
}

describe('CurrencyIcon', () => {
  it('renders initials with an accessible label when no icon exists', () => {
    const w = mount(CurrencyIcon, { props: { code: 'ZZZ', kind: 'fiat', size: 20 } });
    expect(w.text()).toBe('ZZ');
    expect(w.attributes('aria-label')).toBe('ZZZ');
  });

  it('announces the currency on the icon branch too', () => {
    const w = mount(CurrencyIcon, { props: { code: 'USD', kind: 'fiat', size: 20 } });
    const svg = w.find('svg');
    expect(svg.exists()).toBe(true);
    expect(svg.attributes('aria-label')).toBe('USD');
    expect(svg.attributes('aria-hidden')).not.toBe('true');
  });

  /*
   * A euro account in Lisbon. The flag has to arrive from its own chunk first,
   * and until it does the mark shows the currency rather than asking the
   * Iconify API for an icon this app never goes online to fetch.
   */
  it('draws the country once its flag is registered', async () => {
    const w = mount(CurrencyIcon, {
      props: { code: 'EUR', kind: 'fiat', country: 'PT', size: 20 },
    });
    await loadCountryFlags();
    await flushPromises();
    await nextTick();

    expect(drawn(w)).toBe(await namedDrawing('circle-flags:pt'));
    expect(drawn(w)).not.toBe(await namedDrawing('circle-flags:european-union'));
  });

  it('keeps the currency flag when the account has no country', async () => {
    const w = mount(CurrencyIcon, { props: { code: 'EUR', kind: 'fiat', size: 20 } });
    await flushPromises();

    expect(drawn(w)).toBe(await namedDrawing('circle-flags:european-union'));
  });
});
