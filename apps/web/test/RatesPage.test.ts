import { describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import type { CurrencyDto, ProfileDto, RateDto } from '@magermoney/contracts';
import RatesPage from '../src/modules/rates/ui/RatesPage.vue';
import en from '../src/locales/en.json';
import ru from '../src/locales/ru.json';

const profile: ProfileDto = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: null,
  locale: 'en',
  defaultCurrency: 'USD',
  reportingCurrencies: ['USD', 'EUR'],
  onboardingCompletedAt: null,
};

const currency = (code: string): CurrencyDto => ({
  code,
  kind: 'fiat',
  scale: 2,
  symbol: null,
  nameRu: null,
  nameEn: code,
  icon: null,
});

const rates: RateDto[] = [
  { base: 'EUR', quote: 'USD', value: '1.16', date: '2026-09-11', source: 'manual' },
];

function mountRatesPage(fetch: (path: string, init?: RequestInit) => Promise<Response>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(['me'], profile);
  queryClient.setQueryData(['currencies'], [currency('USD'), currency('EUR')]);
  queryClient.setQueryData(['rates', null], rates);

  return mount(RatesPage, {
    global: {
      plugins: [
        [VueQueryPlugin, { queryClient }],
        createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { ru, en } }),
      ],
      provide: { api: { fetch } },
    },
    attachTo: document.body,
  });
}

describe('RatesPage', () => {
  it('shows a manual badge and removes the override by base and date', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const fetch = async (path: string, init?: RequestInit) => {
      calls.push([path, init]);
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      return new Response(null, { status: 500 });
    };
    const w = mountRatesPage(fetch);
    await flushPromises();

    const row = w.get('[data-testid="rate-row-EUR"]');
    expect(row.text()).toContain('manual');

    await row.get('button[aria-label="Remove manual rate"]').trigger('click');
    await flushPromises();

    const del = calls.find(([, init]) => init?.method === 'DELETE');
    expect(del?.[0]).toBe('/rates/manual?base=EUR&date=2026-09-11');
    w.unmount();
  });
});
