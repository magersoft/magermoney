import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import CurrencyIcon from '../src/components/currency-icon/CurrencyIcon.vue';
// The side effect that registers the icon subsets; without it the icon branch
// renders an empty placeholder.
import '../src/index.js';
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
});
