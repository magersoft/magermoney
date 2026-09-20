import { describe, expect, it, vi } from 'vitest';
import { h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import { createRouter, createMemoryHistory } from 'vue-router';
import ru from '../src/locales/ru.json';
import { API_KEY } from '../src/shared/api/use-api.js';
import AccountFormPage from '../src/modules/accounts/ui/AccountFormPage.vue';
import AppShell from '../src/shared/layout/AppShell.vue';

const currencies = [
  { code: 'USD', kind: 'fiat', scale: 2, symbol: null, nameRu: null, nameEn: null, icon: null },
  { code: 'EUR', kind: 'fiat', scale: 2, symbol: null, nameRu: null, nameEn: null, icon: null },
];
const created = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Карман',
  bank: 'Bank',
  country: 'RU',
  currency: 'EUR',
  kind: 'cash',
  cardType: null,
  isSpending: true,
  isPinned: false,
  cardLast4: null,
  cardNetwork: null,
  cardTier: null,
  cardExpires: null,
  note: null,
  sortOrder: 0,
  archivedAt: null,
  balance: null,
  balanceRecordedAt: null,
};
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

async function mountForm(editing?: typeof created, inShell = false) {
  const fetch = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/currencies') return json(currencies);
    if (path === '/accounts' && init?.method === 'POST') return json(created);
    if (path === '/accounts' && editing) return json([editing]);
    return json([]);
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/accounts/new', component: AccountFormPage },
      { path: '/accounts/:id', component: { template: '<div />' } },
      { path: '/accounts/:id/edit', component: AccountFormPage },
    ],
  });
  await router.push(editing ? `/accounts/${editing.id}/edit` : '/accounts/new');
  const w = mount(inShell ? AppShell : AccountFormPage, {
    ...(inShell ? { slots: { default: () => h(AccountFormPage) } } : {}),
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
    /* The combobox list is portalled, so it has to have a document to go to. */
    attachTo: document.body,
  });
  return { w, fetch };
}

/** Opens the country row, types, and takes the country by its code. */
async function pickCountry(
  w: Awaited<ReturnType<typeof mountForm>>['w'],
  query: string,
  code: string,
) {
  await w.get('[data-testid="country-trigger"]').trigger('click');
  await flushPromises();
  const search = document.querySelector<HTMLInputElement>('[data-slot="combobox-input"]')!;
  search.value = query;
  search.dispatchEvent(new Event('input'));
  await flushPromises();
  document.querySelector<HTMLElement>(`[data-testid="country-option-${code}"]`)!.click();
  await flushPromises();
}

describe('AccountFormPage', () => {
  it('asks every question as a row rather than a bordered field', async () => {
    const { w } = await mountForm();
    await flushPromises();

    const rows = w.findAll('[data-slot="form-field-row"]');
    expect(rows.length).toBeGreaterThan(5);
    // The row is the label of the control inside it, so nothing needs an id.
    expect(w.get('[data-testid="form-name"]').element.closest('label')).not.toBeNull();
  });

  it('creates the account from what the rows hold', async () => {
    const { w, fetch } = await mountForm();
    await flushPromises();

    await w.get('[data-testid="form-name"]').setValue('Карман');
    await w.get('[data-testid="form-bank"]').setValue('Bank');
    await pickCountry(w, 'Росс', 'RU');
    await w.get('[data-testid="form-currency"]').setValue('EUR');
    await w.get('[data-testid="account-form"]').trigger('submit');
    await flushPromises();

    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(post).toBeDefined();
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({
      name: 'Карман',
      bank: 'Bank',
      country: 'RU',
      currency: 'EUR',
    });
  });

  /*
   * Whether the account is on Home is the star on its own screen, so the form
   * must not carry an answer of its own: a stale `isPinned` in the PATCH would
   * quietly undo whatever the star was last tapped to say.
   */
  it('leaves the home-screen answer to the star, and sends none of its own', async () => {
    const { w, fetch } = await mountForm();
    await flushPromises();

    expect(w.find('[data-testid="form-pinned"]').exists()).toBe(false);

    await w.get('[data-testid="form-name"]').setValue('Карман');
    await w.get('[data-testid="form-bank"]').setValue('Bank');
    await pickCountry(w, 'Росс', 'RU');
    await w.get('[data-testid="account-form"]').trigger('submit');
    await flushPromises();

    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).not.toHaveProperty('isPinned');
  });

  /*
   * A combobox is not an input with `required`, so nothing but the form stops a
   * save with no country — and the API would only answer with a 422 anyway.
   */
  it('will not save an account with nowhere to be held', async () => {
    const { w, fetch } = await mountForm();
    await flushPromises();

    await w.get('[data-testid="form-name"]').setValue('Карман');
    await w.get('[data-testid="form-bank"]').setValue('Bank');
    await w.get('[data-testid="account-form"]').trigger('submit');
    await flushPromises();

    expect(fetch.mock.calls.find(([, init]) => init?.method === 'POST')).toBeUndefined();
    expect(w.get('[data-testid="country-trigger"]').attributes('aria-invalid')).toBe('true');
    expect(w.text()).toContain(ru.accounts.form.countryRequired);
  });

  /*
   * The bar's corner is the form's save button, and it has to say what the form
   * is: refusing while a required answer is missing, busy while the save is in
   * flight. The button at the foot of the form stays — this is the same action
   * in a second place, not a move.
   */
  it('saves from the top bar, and the bar shows what the form is doing', async () => {
    const { w, fetch } = await mountForm(undefined, true);
    await flushPromises();

    const action = () => w.get('[data-testid="account-form-action"]');
    expect(action().text()).toBe(ru.accounts.form.create);
    expect(action().attributes('disabled')).toBeDefined();
    expect(w.find('[data-testid="form-submit"]').exists()).toBe(true);

    await w.get('[data-testid="form-name"]').setValue('Карман');
    await w.get('[data-testid="form-bank"]').setValue('Bank');
    await pickCountry(w, 'Росс', 'RU');
    expect(action().attributes('disabled')).toBeUndefined();

    await action().trigger('click');
    await flushPromises();

    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ name: 'Карман', country: 'RU' });
  });

  it('opens on the country the account is already held in', async () => {
    const { w } = await mountForm({ ...created, country: 'PT' });
    await flushPromises();

    expect(w.get('[data-testid="country-value"]').text()).toBe(ru.country.PT);
  });
});
