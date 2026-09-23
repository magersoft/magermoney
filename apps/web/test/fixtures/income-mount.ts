import { mount, type ComponentMountingOptions } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { h, type Component } from 'vue';
import AppShell from '../../src/shared/layout/AppShell.vue';
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
  rateSource: 'open-er-api',
});
export const profile = {
  id: 'u',
  displayName: null,
  locale: 'ru',
  defaultCurrency: 'USD',
  reportingCurrencies: ['USD', 'EUR'],
  onboardingCompletedAt: null,
  avatarEmoji: null,
  avatarColor: null,
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
  isPinned: false,
  cardLast4: null,
  cardNetwork: null,
  cardTier: null,
  cardExpires: null,
  colorway: null,
  note: null,
  sortOrder: 0,
  archivedAt: null,
  goalId: null,
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
    if (path === '/me/currencies') return json([cur('USD'), cur('EUR'), cur('RUB')]);
    if (path.startsWith('/rates'))
      return json([
        { base: 'EUR', quote: 'USD', value: '1.16', date: '2026-09-17', source: 'api' },
      ]);
    return json([]);
  };
}

/**
 * `inShell` mounts the screen inside `AppShell`. A screen's top-bar title and
 * action are claimed through the shell, so a bare mount has nowhere to put
 * them — and asserting about them without the shell asserts about a
 * configuration the app never renders.
 */
export async function mountAt<C extends Component>(
  component: C,
  at: string,
  fetch: Fetch,
  options: ComponentMountingOptions<C> = {},
  inShell = false,
) {
  const blank = { template: '<i />' };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: blank },
      { path: '/accounts', component: blank },
      { path: '/accounts/:id', component: blank },
      { path: '/accounts/:id/edit', component: blank },
      { path: '/plan', name: 'plan', component: blank },
      { path: '/plan/income/new', component: blank },
      { path: '/plan/income/:id', component: blank },
      { path: '/plan/income/:id/edit', component: blank },
      { path: '/plan/budgets/new', name: 'budget-new', component: blank },
      { path: '/plan/budgets/:id/edit', name: 'budget-edit', component: blank },
      { path: '/goals', name: 'savings', component: blank },
      { path: '/goals/new', name: 'goal-new', component: blank },
      { path: '/goals/:id', name: 'goal', component: blank },
      { path: '/goals/:id/edit', name: 'goal-edit', component: blank },
      { path: '/assets/new', name: 'asset-new', component: blank },
      { path: '/assets/:id', name: 'asset', component: blank },
      { path: '/assets/:id/edit', name: 'asset-edit', component: blank },
    ],
  });
  await router.push(at);
  await router.isReady();
  const wrapper = mount(inShell ? (AppShell as unknown as C) : component, {
    ...options,
    ...(inShell ? { slots: { default: () => h(component as Component) } } : {}),
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
