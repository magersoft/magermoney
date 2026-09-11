import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import type { CurrencyDto, ProfileDto, RateDto } from '@magermoney/contracts';
import MoneyText from '../src/modules/rates/ui/MoneyText.vue';
import { useDisplayCurrency } from '../src/modules/rates/application/use-display-currency.js';
import en from '../src/locales/en.json';
import ru from '../src/locales/ru.json';

const profile: ProfileDto = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: null,
  locale: 'en',
  defaultCurrency: 'USD',
  reportingCurrencies: ['USD', 'EUR', 'KZT'],
  onboardingCompletedAt: null,
};

const currency = (code: string, kind: CurrencyDto['kind'] = 'fiat'): CurrencyDto => ({
  code,
  kind,
  scale: 2,
  symbol: null,
  nameRu: null,
  nameEn: code,
  icon: null,
});

const rates: RateDto[] = [
  { base: 'EUR', quote: 'USD', value: '1.16', date: '2026-09-11', source: 'api' },
];

/** The screen never fetches here: the cache is seeded, which is what an offline reload looks like. */
function mountMoneyText() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(['me'], profile);
  queryClient.setQueryData(['currencies'], [currency('USD'), currency('EUR'), currency('KZT')]);
  queryClient.setQueryData(['rates', null], rates);

  const Probe = defineComponent({
    setup() {
      return () => h(MoneyText, { amount: '100', currency: 'EUR' });
    },
  });

  return mount(Probe, {
    global: {
      plugins: [
        [VueQueryPlugin, { queryClient }],
        createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { ru, en } }),
      ],
      provide: { api: { fetch: () => Promise.reject(new Error('offline')) } },
    },
  });
}

describe('MoneyText', () => {
  it('converts into the display currency and formats it', async () => {
    const wrapper = mountMoneyText();
    await flushPromises();

    expect(wrapper.text()).toContain('$116.00');
  });

  it('says so when the date has no rate for the display currency', async () => {
    const wrapper = mountMoneyText();
    await flushPromises();

    useDisplayCurrency().set('KZT');
    await flushPromises();

    expect(wrapper.text()).toContain('—');
    expect(wrapper.get('[data-amount]').attributes('title')).toContain('KZT');
  });
});
