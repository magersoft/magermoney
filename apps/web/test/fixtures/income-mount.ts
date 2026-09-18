import { mount, type ComponentMountingOptions } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import type { Component } from 'vue';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';
import ru from '../../src/locales/ru.json';
import { API_KEY } from '../../src/shared/api/use-api.js';

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
export const cur = (code: string) => ({
  code,
  kind: 'fiat',
  scale: 2,
  symbol: null,
  nameRu: null,
  nameEn: null,
  icon: null,
});
export const profile = {
  id: 'u',
  displayName: null,
  locale: 'ru',
  defaultCurrency: 'USD',
  reportingCurrencies: ['USD', 'EUR'],
  onboardingCompletedAt: null,
};
export const acc = (id: string, currency: string, over: object = {}) => ({
  id,
  name: `Acc ${currency}`,
  bank: 'B',
  country: 'RU',
  currency,
  kind: 'bank_account',
  cardType: null,
  isSpending: true,
  cardLast4: null,
  cardNetwork: null,
  cardTier: null,
  cardExpires: null,
  note: null,
  sortOrder: 0,
  archivedAt: null,
  balance: '100',
  balanceRecordedAt: '2026-09-01T00:00:00.000Z',
  ...over,
});

export type Fetch = (path: string, init?: RequestInit) => Promise<Response>;

/** Answers the reference data every screen asks for; `routes` answers the rest, first match wins. */
export function apiOf(routes: (path: string, init?: RequestInit) => Response | undefined): Fetch {
  return async (path, init) => {
    const own = routes(path, init);
    if (own) return own;
    if (path === '/me') return json(profile);
    if (path === '/currencies') return json([cur('USD'), cur('EUR'), cur('RUB')]);
    if (path.startsWith('/rates'))
      return json([
        { base: 'EUR', quote: 'USD', value: '1.16', date: '2026-09-17', source: 'api' },
      ]);
    return json([]);
  };
}

export async function mountAt<C extends Component>(
  component: C,
  at: string,
  fetch: Fetch,
  options: ComponentMountingOptions<C> = {},
) {
  const blank = { template: '<i />' };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: blank },
      { path: '/plan', component: blank },
      { path: '/plan/income/new', component: blank },
      { path: '/plan/income/:id', component: blank },
      { path: '/plan/income/:id/edit', component: blank },
    ],
  });
  await router.push(at);
  await router.isReady();
  const wrapper = mount(component, {
    ...options,
    global: {
      plugins: [
        [
          VueQueryPlugin,
          {
            queryClient: new QueryClient({
              defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
            }),
          },
        ],
        createI18n({ legacy: false, locale: 'ru', messages: { ru } }),
        router,
      ],
      provide: { [API_KEY as unknown as string]: { fetch } },
    },
    attachTo: document.body,
  } as ComponentMountingOptions<C>);
  return { wrapper, router };
}
