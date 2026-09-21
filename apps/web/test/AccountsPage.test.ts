import { describe, expect, it, vi } from 'vitest';
import { h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';
import ru from '../src/locales/ru.json';
import { API_KEY } from '../src/shared/api/use-api.js';
import { resetDisplayCurrency } from '../src/modules/rates/application/use-display-currency.js';
import AccountsPage from '../src/modules/accounts/ui/AccountsPage.vue';
import AppShell from '../src/shared/layout/AppShell.vue';

const toast = vi.fn();
vi.mock('@magermoney/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@magermoney/ui')>();
  return { ...actual, useToast: () => ({ toast }) };
});

/** Every path the mounted page asked for, in order, across the whole mount. */
const paths: string[] = [];

const profile = {
  id: 'u',
  displayName: null,
  locale: 'ru',
  defaultCurrency: 'USD',
  reportingCurrencies: ['USD', 'EUR'],
  onboardingCompletedAt: null,
};
const currencies = [
  {
    code: 'USD',
    kind: 'fiat',
    scale: 2,
    symbol: null,
    nameRu: null,
    nameEn: null,
    icon: null,
    rateSource: 'open-er-api',
  },
  {
    code: 'EUR',
    kind: 'fiat',
    scale: 2,
    symbol: null,
    nameRu: null,
    nameEn: null,
    icon: null,
    rateSource: 'open-er-api',
  },
];
const rates = [{ base: 'EUR', quote: 'USD', value: '1.16', date: '2026-09-11', source: 'api' }];
const acc = (id: string, over: object) => ({
  id,
  name: id,
  bank: 'Bank',
  country: 'RU',
  currency: 'USD',
  kind: 'cash',
  cardType: null,
  isSpending: false,
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
  balanceRecordedAt: null,
  ...over,
});
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const USD_ID = '11111111-1111-4111-8111-111111111111';
const EUR_ID = '22222222-2222-4222-8222-222222222222';
const ARCHIVED_ID = '33333333-3333-4333-8333-333333333333';

function mountPage(accounts: unknown[], inShell = false, refreshStatus = 200) {
  resetDisplayCurrency();
  const fetch = vi.fn(async (path: string) => {
    paths.push(path);
    if (path === '/me') return json(profile);
    if (path === '/me/currencies') return json(currencies);
    if (path === '/rates/refresh')
      return refreshStatus === 200
        ? json({ stored: 2, refreshed: true, refreshedAt: '2026-09-20T09:00:00.000Z' })
        : new Response(JSON.stringify({ code: 'PROVIDER_FAILED', message: 'boom' }), {
            status: 502,
            headers: { 'content-type': 'application/json' },
          });
    if (path.startsWith('/rates')) return json(rates);
    return json(accounts);
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: AccountsPage },
      { path: '/accounts', component: AccountsPage },
      { path: '/accounts/new', component: { template: '<div />' } },
      { path: '/accounts/:id', component: { template: '<div />' } },
    ],
  });
  return mount(inShell ? AppShell : AccountsPage, {
    ...(inShell ? { slots: { default: () => h(AccountsPage) } } : {}),
    global: {
      plugins: [
        [
          VueQueryPlugin,
          { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
        ],
        createI18n({ legacy: false, locale: 'ru', messages: { ru } }),
        router,
      ],
      provide: { [API_KEY as unknown as string]: { fetch } },
      stubs: { Motion: { template: '<div><slot /></div>' } },
    },
  });
}

describe('AccountsPage', () => {
  /* The gesture has no keyboard, so the test drives what the gesture drives. */
  const pull = async (w: ReturnType<typeof mountPage>) => {
    const { PullToRefresh } = await import('@magermoney/ui');
    await (
      w.findComponent(PullToRefresh).vm as unknown as { refresh: () => Promise<void> }
    ).refresh();
    await flushPromises();
  };

  /* The list's action is the bar's, so it only exists with the bar around it. */
  it('offers the new account from the top bar', async () => {
    const w = mountPage([acc(USD_ID, {})], true);
    await flushPromises();

    const add = w.get('[data-testid="accounts-add-action"]');
    expect(add.attributes('aria-label')).toBe(ru.accounts.add);
    await add.trigger('click');
    await flushPromises();
    expect(w.vm.$router.currentRoute.value.path).toBe('/accounts/new');
  });

  it('shows the total with its rate footnote and one card per active account', async () => {
    const w = mountPage([
      acc(USD_ID, { isSpending: true }),
      acc(EUR_ID, { currency: 'EUR', bank: 'Other' }),
      acc(ARCHIVED_ID, { archivedAt: '2026-01-01T00:00:00.000Z' }),
    ]);
    await flushPromises();

    expect(w.get('[data-testid="capital-total"]').text()).toContain('216');
    expect(w.get('[data-testid="accounts-rate-note"]').text()).toContain('2026-09-11');
    expect(w.findAll('[data-slot="account-card"]')).toHaveLength(2);
    expect(w.get('[data-testid="accounts-count"]').text()).toContain('2');
  });

  it('marks the accounts that are on the home screen', async () => {
    const w = mountPage([acc(USD_ID, { isPinned: true }), acc(EUR_ID, { currency: 'EUR' })]);
    await flushPromises();

    const marks = w.findAll('[data-slot="account-card-pinned"]');
    expect(marks).toHaveLength(1);
    expect(marks[0]!.attributes('aria-label')).toBe(ru.accounts.pinned);
    expect(w.findAll('[data-slot="account-card"]')[0]!.text()).toContain(USD_ID);
  });

  it('cards lead to their account and keep the tab order of the stack', async () => {
    const w = mountPage([acc(USD_ID, {}), acc(EUR_ID, { currency: 'EUR' })]);
    await flushPromises();

    const cards = w.findAll('[data-slot="account-card"]');
    expect(cards.map((c) => c.attributes('href'))).toEqual([
      `/accounts/${USD_ID}`,
      `/accounts/${EUR_ID}`,
    ]);
    expect(w.findAll('[tabindex]')).toHaveLength(0);
  });

  it('filters the stack by currency and drops the filter from its chip', async () => {
    const w = mountPage([acc(USD_ID, {}), acc(EUR_ID, { currency: 'EUR' })]);
    await flushPromises();

    const select = w.get('[data-testid="accounts-currency-filter"]');
    await select.setValue('EUR');

    expect(w.findAll('[data-slot="account-card"]')).toHaveLength(1);
    expect(w.get('[data-slot="account-card"]').attributes('href')).toBe(`/accounts/${EUR_ID}`);

    await w.get('[data-slot="filter-chip-remove"]').trigger('click');

    expect(w.findAll('[data-slot="account-card"]')).toHaveLength(2);
    expect(w.find('[data-slot="filter-chip"]').exists()).toBe(false);
  });

  it('waits with a stack-shaped skeleton instead of claiming the filter found nothing', async () => {
    const w = mountPage([acc(USD_ID, {})]);

    expect(w.find('[data-testid="accounts-loading"]').exists()).toBe(true);
    expect(w.find('[data-testid="accounts-filter-empty"]').exists()).toBe(false);

    await flushPromises();

    expect(w.find('[data-testid="accounts-loading"]').exists()).toBe(false);
  });

  it('offers the first account when there is none', async () => {
    const w = mountPage([]);
    await flushPromises();

    expect(w.get('[data-testid="accounts-add"]').attributes('href')).toBe('/accounts/new');
    expect(w.find('[data-slot="account-card"]').exists()).toBe(false);
  });

  it('exposes the archived disclosure state to assistive tech', async () => {
    const w = mountPage([acc(ARCHIVED_ID, { archivedAt: '2026-01-01T00:00:00.000Z' })]);
    await flushPromises();

    const toggle = w.get('button[aria-controls="archived-accounts"]');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    expect(w.find(`[data-testid="account-row-${ARCHIVED_ID}"]`).exists()).toBe(false);

    await toggle.trigger('click');

    expect(toggle.attributes('aria-expanded')).toBe('true');
    expect(w.find(`[data-testid="account-row-${ARCHIVED_ID}"]`).exists()).toBe(true);
  });

  it('reloads the accounts and asks for fresh rates when the list is pulled down', async () => {
    paths.length = 0;
    toast.mockClear();
    const w = mountPage([acc(USD_ID, {})]);
    await flushPromises();
    const before = paths.length;

    await pull(w);

    expect(paths.slice(before)).toContain('/rates/refresh');
    expect(paths.slice(before)).toContain('/accounts');
    expect(toast).not.toHaveBeenCalled();
  });

  it('still reloads the accounts when the rates cannot be fetched, and says so', async () => {
    paths.length = 0;
    toast.mockClear();
    const w = mountPage([acc(USD_ID, {})], false, 502);
    await flushPromises();
    const before = paths.length;

    await pull(w);

    expect(paths.slice(before)).toContain('/accounts');
    expect(toast).toHaveBeenCalledWith(ru.rates.refreshFailed);
    expect(w.find('[data-testid="capital-total"]').exists()).toBe(true);
  });
});
