import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import { PullToRefresh } from '@magermoney/ui';
import type { CurrencyDto, ProfileDto, RateDto } from '@magermoney/contracts';
import RatesPage from '../src/modules/rates/ui/RatesPage.vue';
import en from '../src/locales/en.json';
import ru from '../src/locales/ru.json';

const toast = vi.fn();
vi.mock('@magermoney/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@magermoney/ui')>();
  return { ...actual, useToast: () => ({ toast }) };
});

const profile: ProfileDto = {
  id: '11111111-1111-4111-8111-111111111111',
  displayName: null,
  locale: 'en',
  defaultCurrency: 'USD',
  reportingCurrencies: ['USD', 'EUR'],
  onboardingCompletedAt: null,
  avatarEmoji: null,
  avatarColor: null,
};

const currency = (code: string): CurrencyDto => ({
  code,
  kind: 'fiat',
  scale: 2,
  symbol: null,
  nameRu: null,
  nameEn: code,
  icon: null,
  rateSource: 'open-er-api',
});

const rates: RateDto[] = [
  { base: 'EUR', quote: 'USD', value: '1.16', date: '2026-09-11', source: 'manual' },
];

function mountRatesPage(fetch: (path: string, init?: RequestInit) => Promise<Response>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(['me'], profile);
  queryClient.setQueryData(['currencies', 'connected'], [currency('USD'), currency('EUR')]);
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

    // The rate itself is a button too: without a label it is read out as just a number.
    expect(row.get('button[aria-label="1 EUR"]').text()).toBe('$1.16');

    await row.get('button[aria-label="Remove manual rate"]').trigger('click');
    await flushPromises();

    const del = calls.find(([, init]) => init?.method === 'DELETE');
    expect(del?.[0]).toBe('/rates/manual?base=EUR&date=2026-09-11');
    w.unmount();
  });

  /* The gesture has no keyboard, so the test drives what the gesture drives. */
  const pull = (w: ReturnType<typeof mountRatesPage>) =>
    (w.findComponent(PullToRefresh).vm as unknown as { refresh: () => Promise<void> }).refresh();

  const refreshed = (body: unknown) => async (path: string, init?: RequestInit) => {
    if (path === '/rates/refresh' && init?.method === 'POST')
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    if (path.startsWith('/rates')) return new Response(JSON.stringify(rates), { status: 200 });
    return new Response(null, { status: 500 });
  };

  it('asks the API for fresh rates when the list is pulled down, and refetches them', async () => {
    toast.mockClear();
    const paths: string[] = [];
    const fetch = async (path: string, init?: RequestInit) => {
      paths.push(path);
      return refreshed({
        stored: 4,
        refreshed: true,
        refreshedAt: '2026-09-20T09:00:00.000Z',
      })(path, init);
    };
    const w = mountRatesPage(fetch);
    await flushPromises();

    await pull(w);
    await flushPromises();

    // The refresh invalidates the rates query, so the table is read again after it.
    const refreshCall = paths.indexOf('/rates/refresh');
    expect(refreshCall).toBeGreaterThanOrEqual(0);
    expect(paths.slice(refreshCall + 1)).toContain('/rates');
    expect(toast).not.toHaveBeenCalled();
    w.unmount();
  });

  it('says the rates are already the latest, calmly, rather than reporting a failure', async () => {
    toast.mockClear();
    const w = mountRatesPage(
      refreshed({ stored: 0, refreshed: false, refreshedAt: '2026-09-20T09:00:00.000Z' }),
    );
    await flushPromises();

    await pull(w);
    await flushPromises();

    expect(toast).toHaveBeenCalledWith('These are already the latest rates.');
    w.unmount();
  });

  it('keeps the list when the refresh fails, and says so', async () => {
    toast.mockClear();
    const fetch = async (path: string, init?: RequestInit) => {
      if (path === '/rates/refresh' && init?.method === 'POST')
        return new Response(JSON.stringify({ code: 'PROVIDER_FAILED', message: 'boom' }), {
          status: 502,
          headers: { 'content-type': 'application/json' },
        });
      return new Response(JSON.stringify(rates), { status: 200 });
    };
    const w = mountRatesPage(fetch);
    await flushPromises();

    await pull(w);
    await flushPromises();

    expect(toast).toHaveBeenCalledWith('Could not fetch the rates. Try again in a moment.');
    expect(w.find('[data-testid="rate-row-EUR"]').exists()).toBe(true);
    w.unmount();
  });
});
