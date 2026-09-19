import { describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import BudgetFormPage from '../src/modules/budgets/ui/BudgetFormPage.vue';
import { apiOf, json, mountAt } from './fixtures/income-mount.js';

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@magermoney/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@magermoney/ui')>();
  return { ...actual, useToast: () => ({ toast }) };
});

const ID = '11111111-1111-4111-8111-111111111111';
const dto = {
  id: ID,
  name: 'Groceries',
  icon: null,
  monthlyLimit: '1000',
  currency: 'EUR',
  activeFrom: '2026-01-01',
  activeTo: null,
};

describe('BudgetFormPage', () => {
  it('creates a budget and returns to the budgets segment', async () => {
    let body: unknown;
    const { wrapper, router } = await mountAt(
      BudgetFormPage,
      '/plan/budgets/new',
      apiOf((path, init) => {
        if (path !== '/budgets' || init?.method !== 'POST') return undefined;
        body = JSON.parse(String(init.body));
        return json(dto, 201);
      }),
    );
    await flushPromises();
    await wrapper.get('[data-testid="budget-name"]').setValue('Groceries');
    await wrapper.get('[data-testid="budget-limit"]').setValue('1000');
    await wrapper.get('[data-testid="budget-form"]').trigger('submit');
    await flushPromises();
    expect(body).toMatchObject({ name: 'Groceries', monthlyLimit: '1000', currency: 'EUR' });
    expect(router.currentRoute.value.fullPath).toBe('/plan?tab=budgets');
    wrapper.unmount();
  });

  it('holds Save until there is a limit above zero', async () => {
    const { wrapper } = await mountAt(
      BudgetFormPage,
      '/plan/budgets/new',
      apiOf(() => undefined),
    );
    await flushPromises();
    const submit = () => wrapper.get('[data-testid="budget-submit"]');
    await wrapper.get('[data-testid="budget-name"]').setValue('Groceries');
    expect(submit().attributes('disabled')).toBeDefined();
    await wrapper.get('[data-testid="budget-limit"]').setValue('0');
    expect(submit().attributes('disabled')).toBeDefined();
    await wrapper.get('[data-testid="budget-limit"]').setValue('1000');
    expect(submit().attributes('disabled')).toBeUndefined();
    wrapper.unmount();
  });

  it('says so when the budget being edited is not there', async () => {
    const { wrapper } = await mountAt(
      BudgetFormPage,
      '/plan/budgets/99999999-9999-4999-8999-999999999999/edit',
      apiOf(() => undefined),
    );
    await flushPromises();
    expect(wrapper.find('[data-testid="budget-form"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="budget-back"]').text()).toContain('Бюджеты');
    wrapper.unmount();
  });

  it('ends a budget today with a PATCH of activeTo', async () => {
    const patches: unknown[] = [];
    const { wrapper } = await mountAt(
      BudgetFormPage,
      `/plan/budgets/${ID}/edit`,
      apiOf((path, init) => {
        if (!path.startsWith('/budgets')) return undefined;
        if (init?.method !== 'PATCH') return json([dto]);
        patches.push(JSON.parse(String(init.body)));
        return json(dto);
      }),
    );
    await flushPromises();
    expect((wrapper.get('[data-testid="budget-name"]').element as HTMLInputElement).value).toBe(
      'Groceries',
    );
    await wrapper.get('[data-testid="budget-end"]').trigger('click');
    await flushPromises();
    expect(patches[0]).toEqual({ activeTo: new Date().toISOString().slice(0, 10) });
    wrapper.unmount();
  });
});
