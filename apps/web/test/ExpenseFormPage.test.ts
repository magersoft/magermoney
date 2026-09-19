import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';
import ru from '../src/locales/ru.json';
import { API_KEY } from '../src/shared/api/use-api.js';
import { resetDisplayCurrency } from '../src/modules/rates/application/use-display-currency.js';
import ExpenseFormPage from '../src/modules/expenses/ui/ExpenseFormPage.vue';

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@magermoney/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@magermoney/ui')>();
  return { ...actual, useToast: () => ({ toast }) };
});

const CAT = '22222222-2222-4222-8222-222222222222';
const ID = '11111111-1111-4111-8111-111111111111';
const dto = {
  id: ID,
  categoryId: CAT,
  name: 'Rent',
  amount: '1400',
  currency: 'EUR',
  period: 'monthly',
  billingDay: null,
  billingMonth: null,
  isEssential: false,
  activeFrom: '2026-01-01',
  activeTo: null,
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** The sheet is portalled to the body, so that is where the form is read from. */
const sheet = () => new DOMWrapper(document.body);
const field = (testid: string) => sheet().get(`[data-testid="${testid}"] input`);
const amount = () => sheet().get('[data-slot="quick-action-amount"] input');
const confirm = () => sheet().get('[data-slot="quick-action-confirm"]');

async function mountForm(
  path: string,
  fetch: (p: string, init?: RequestInit) => Promise<Response>,
) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/plan', name: 'plan', component: { template: '<div />' } },
      { path: '/plan/expenses/new', name: 'expense-new', component: ExpenseFormPage },
      { path: '/plan/expenses/:id/edit', name: 'expense-edit', component: ExpenseFormPage },
    ],
  });
  await router.push(path);
  const w = mount(ExpenseFormPage, {
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
  });
  await flushPromises();
  return { w, router };
}

const base = (path: string) => {
  if (path === '/currencies')
    return json([
      { code: 'EUR', kind: 'fiat', scale: 2, symbol: null, nameRu: null, nameEn: null, icon: null },
    ]);
  if (path === '/expense-categories')
    return json([{ id: CAT, name: 'Housing', icon: null, sortOrder: 0 }]);
  return null;
};

describe('ExpenseFormPage', () => {
  // The display currency is one instance for the whole app; each mount gets its own.
  beforeEach(() => resetDisplayCurrency());

  it('opens a new expense in the currency the screens already report in', async () => {
    const fetch = vi.fn(async (path: string) => {
      if (path === '/me')
        return json({
          id: '11111111-1111-4111-8111-111111111111',
          displayName: null,
          locale: 'ru',
          defaultCurrency: 'RUB',
          reportingCurrencies: ['RUB', 'EUR'],
          onboardingCompletedAt: null,
        });
      if (path === '/currencies')
        return json(
          ['EUR', 'RUB'].map((code) => ({
            code,
            kind: 'fiat',
            scale: 2,
            symbol: null,
            nameRu: null,
            nameEn: null,
            icon: null,
          })),
        );
      return base(path) ?? json([]);
    });
    const { w } = await mountForm('/plan/expenses/new', fetch);
    /* The currency stands beside the amount now, which is the first field. */
    expect(
      (sheet().get('[data-slot="quick-action-currency"]').element as HTMLSelectElement).value,
    ).toBe('RUB');
    w.unmount();
  });

  it('sends categoryName for a category typed in, and categoryId for a known one', async () => {
    const posts: unknown[] = [];
    const fetch = vi.fn(async (path: string, init?: RequestInit) => {
      const b = base(path);
      if (b) return b;
      if (init?.method === 'POST') {
        posts.push(JSON.parse(String(init.body)));
        return json(dto, 201);
      }
      return json([]);
    });
    const { w, router } = await mountForm('/plan/expenses/new', fetch);
    await field('expense-name').setValue('Gym');
    await amount().setValue('30');
    await field('expense-category').setValue('Health');
    await confirm().trigger('click');
    await flushPromises();
    expect(posts[0]).toMatchObject({ name: 'Gym', amount: '30', categoryName: 'Health' });
    expect(posts[0]).not.toHaveProperty('categoryId');
    expect(router.currentRoute.value.fullPath).toBe('/plan?tab=expenses');
    w.unmount();

    await router.push('/plan/expenses/new');
    const second = await mountForm('/plan/expenses/new', fetch);
    await field('expense-name').setValue('Rent');
    await amount().setValue('1400');
    await field('expense-category').setValue('housing');
    await confirm().trigger('click');
    await flushPromises();
    expect(posts[1]).toMatchObject({ categoryId: CAT });
    expect(posts[1]).not.toHaveProperty('categoryName');
    second.w.unmount();
  });

  /*
   * A disabled button says «no» without saying why. The sheet takes the press
   * and answers on the field that is wrong, which is also what a screen reader
   * is given.
   */
  it('answers a missing amount on the field instead of sending anything', async () => {
    const posts: unknown[] = [];
    const fetch = vi.fn(async (path: string, init?: RequestInit) => {
      const b = base(path);
      if (b) return b;
      if (init?.method === 'POST') posts.push(JSON.parse(String(init.body)));
      return json([]);
    });
    const { w } = await mountForm('/plan/expenses/new', fetch);
    await field('expense-name').setValue('Gym');
    await field('expense-category').setValue('Health');
    await confirm().trigger('click');
    await flushPromises();
    expect(posts).toHaveLength(0);
    expect(sheet().get('[data-testid="expense-amount-error"]').text()).toContain('сумму');

    await amount().setValue('30');
    await confirm().trigger('click');
    await flushPromises();
    expect(posts).toHaveLength(1);
    w.unmount();
  });

  it('names the field that was left empty, and announces it', async () => {
    const fetch = vi.fn(async (path: string) => base(path) ?? json([]));
    const { w } = await mountForm('/plan/expenses/new', fetch);
    await amount().setValue('30');
    await confirm().trigger('click');
    await flushPromises();
    const name = field('expense-name');
    expect(name.attributes('aria-invalid')).toBe('true');
    const errorId = name.attributes('aria-describedby')!;
    expect(document.getElementById(errorId)?.textContent).toContain('название');
    w.unmount();
  });

  it('says so when the expense being edited is not there', async () => {
    const fetch = vi.fn(async (path: string) => base(path) ?? json([]));
    const { w } = await mountForm(
      '/plan/expenses/99999999-9999-4999-8999-999999999999/edit',
      fetch,
    );
    expect(sheet().find('[data-testid="expense-form"]').exists()).toBe(false);
    expect(w.get('[data-testid="expense-back"]').text()).toContain('Расходы');
    w.unmount();
  });

  it('ends an expense today with a PATCH of activeTo', async () => {
    const patches: unknown[] = [];
    const fetch = vi.fn(async (path: string, init?: RequestInit) => {
      const b = base(path);
      if (b) return b;
      if (init?.method === 'PATCH') {
        patches.push(JSON.parse(String(init.body)));
        return json(dto);
      }
      return json([dto]);
    });
    const { w } = await mountForm(`/plan/expenses/${ID}/edit`, fetch);
    expect((field('expense-name').element as HTMLInputElement).value).toBe('Rent');
    await sheet().get('[data-testid="expense-end"]').trigger('click');
    await flushPromises();
    expect(patches[0]).toEqual({ activeTo: new Date().toISOString().slice(0, 10) });
    w.unmount();
  });
});
