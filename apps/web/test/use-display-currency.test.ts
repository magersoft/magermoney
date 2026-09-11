import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { createDisplayCurrency } from '../src/modules/rates/application/use-display-currency.js';
describe('display currency', () => {
  it('starts from the profile default and only accepts listed options', () => {
    const profile = ref({ defaultCurrency: 'EUR', reportingCurrencies: ['EUR', 'USD', 'RUB'] });
    const d = createDisplayCurrency(profile, { get: () => null, set: () => {} });
    expect(d.current.value).toBe('EUR');
    d.set('USD'); expect(d.current.value).toBe('USD');
    d.set('KZT'); expect(d.current.value).toBe('USD');
  });
  it('restores a remembered choice when still listed, else falls back', () => {
    const profile = ref({ defaultCurrency: 'EUR', reportingCurrencies: ['EUR', 'USD'] });
    expect(createDisplayCurrency(profile, { get: () => 'USD', set: () => {} }).current.value).toBe('USD');
    expect(createDisplayCurrency(profile, { get: () => 'KZT', set: () => {} }).current.value).toBe('EUR');
  });
});
