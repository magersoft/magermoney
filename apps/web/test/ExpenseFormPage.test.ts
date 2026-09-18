import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';
import ru from '../src/locales/ru.json';
import { API_KEY } from '../src/shared/api/use-api.js';
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
    await w.get('[data-testid="expense-name"]').setValue('Gym');
    await w.get('[data-testid="expense-amount"]').setValue('30');
    await w.get('[data-testid="expense-category"]').setValue('Health');
    await w.get('[data-testid="expense-form"]').trigger('submit');
    await flushPromises();
    expect(posts[0]).toMatchObject({ name: 'Gym', amount: '30', categoryName: 'Health' });
    expect(posts[0]).not.toHaveProperty('categoryId');
    expect(router.currentRoute.value.fullPath).toBe('/plan?tab=expenses');

    await router.push('/plan/expenses/new');
    const second = await mountForm('/plan/expenses/new', fetch);
    await second.w.get('[data-testid="expense-name"]').setValue('Rent');
    await second.w.get('[data-testid="expense-amount"]').setValue('1400');
    await second.w.get('[data-testid="expense-category"]').setValue('housing');
    await second.w.get('[data-testid="expense-form"]').trigger('submit');
    await flushPromises();
    expect(posts[1]).toMatchObject({ categoryId: CAT });
    expect(posts[1]).not.toHaveProperty('categoryName');
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
    expect((w.get('[data-testid="expense-name"]').element as HTMLInputElement).value).toBe('Rent');
    await w.get('[data-testid="expense-end"]').trigger('click');
    await flushPromises();
    expect(patches[0]).toEqual({ activeTo: new Date().toISOString().slice(0, 10) });
  });
});
