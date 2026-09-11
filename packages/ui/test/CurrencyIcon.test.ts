import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import CurrencyIcon from '../src/components/currency-icon/CurrencyIcon.vue';
describe('CurrencyIcon', () => {
  it('renders initials with an accessible label when no icon exists', () => {
    const w = mount(CurrencyIcon, { props: { code: 'ZZZ', kind: 'fiat', size: 20 } });
    expect(w.text()).toBe('ZZ');
    expect(w.attributes('aria-label')).toBe('ZZZ');
  });
});
