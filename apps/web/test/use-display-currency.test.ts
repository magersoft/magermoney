import { describe, expect, it } from 'vitest';
import { nextTick, ref } from 'vue';
import { createDisplayCurrency } from '../src/modules/rates/application/use-display-currency.js';
describe('display currency', () => {
  it('takes the profile default once the profile arrives', async () => {
    const profile = ref<{ defaultCurrency: string; reportingCurrencies: string[] } | undefined>(
      undefined,
    );
    const d = createDisplayCurrency(profile, { get: () => null, set: () => {} });

    profile.value = { defaultCurrency: 'EUR', reportingCurrencies: ['USD', 'EUR'] };
    await nextTick();

    expect(d.current.value).toBe('EUR');
  });

  it('takes the remembered choice once the profile arrives', async () => {
    const profile = ref<{ defaultCurrency: string; reportingCurrencies: string[] } | undefined>(
      undefined,
    );
    const d = createDisplayCurrency(profile, { get: () => 'RUB', set: () => {} });

    profile.value = { defaultCurrency: 'EUR', reportingCurrencies: ['USD', 'EUR', 'RUB'] };
    await nextTick();

    expect(d.current.value).toBe('RUB');
  });

  it('keeps a choice made before the profile arrived', async () => {
    const profile = ref<{ defaultCurrency: string; reportingCurrencies: string[] } | undefined>(
      undefined,
    );
    const d = createDisplayCurrency(profile, { get: () => null, set: () => {} });

    d.set('USD');
    profile.value = { defaultCurrency: 'EUR', reportingCurrencies: ['USD', 'EUR'] };
    await nextTick();

    expect(d.current.value).toBe('USD');
  });

  it('starts from the profile default and only accepts listed options', () => {
    const profile = ref({ defaultCurrency: 'EUR', reportingCurrencies: ['EUR', 'USD', 'RUB'] });
    const d = createDisplayCurrency(profile, { get: () => null, set: () => {} });
    expect(d.current.value).toBe('EUR');
    d.set('USD');
    expect(d.current.value).toBe('USD');
    d.set('KZT');
    expect(d.current.value).toBe('USD');
  });
  it('moves off a currency that was taken out of the switch', async () => {
    const profile = ref({ defaultCurrency: 'EUR', reportingCurrencies: ['EUR', 'USD', 'RUB'] });
    const d = createDisplayCurrency(profile, { get: () => null, set: () => {} });
    d.set('RUB');
    expect(d.current.value).toBe('RUB');

    // The ruble is unmarked on the currencies screen.
    profile.value = { defaultCurrency: 'EUR', reportingCurrencies: ['EUR', 'USD'] };
    await nextTick();

    // Whatever it lands on, it is something the switch actually offers.
    expect(d.options.value).toContain(d.current.value);
    expect(d.current.value).toBe('EUR');
  });

  it('never leaves the switch empty: one currency is still a display currency', () => {
    const profile = ref({ defaultCurrency: 'USD', reportingCurrencies: ['USD'] });
    const d = createDisplayCurrency(profile, { get: () => 'EUR', set: () => {} });
    expect(d.current.value).toBe('USD');
    expect(d.options.value).toEqual(['USD']);
  });

  it('restores a remembered choice when still listed, else falls back', () => {
    const profile = ref({ defaultCurrency: 'EUR', reportingCurrencies: ['EUR', 'USD'] });
    expect(createDisplayCurrency(profile, { get: () => 'USD', set: () => {} }).current.value).toBe(
      'USD',
    );
    expect(createDisplayCurrency(profile, { get: () => 'KZT', set: () => {} }).current.value).toBe(
      'EUR',
    );
  });
});
