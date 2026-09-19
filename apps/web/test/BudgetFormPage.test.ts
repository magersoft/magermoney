import { describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises } from '@vue/test-utils';
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

describe('BudgetFormPage — the wizard', () => {
  const openWizard = (routes: Parameters<typeof apiOf>[0] = () => undefined) =>
    mountAt(BudgetFormPage, '/plan/budgets/new', apiOf(routes));
  const next = (w: { get: (s: string) => { trigger: (e: string) => Promise<void> } }) =>
    w.get('[data-testid="budget-next"]').trigger('click');

  it('walks the five steps and writes one budget per category picked', async () => {
    const posts: Record<string, unknown>[] = [];
    const { wrapper, router } = await openWizard((path, init) => {
      if (path !== '/budgets' || init?.method !== 'POST') return undefined;
      posts.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return json(dto, 201);
    });
    await flushPromises();

    expect(wrapper.get('[data-testid="budget-step-of"]').text()).toContain('1');
    expect(wrapper.find('[data-testid="budget-step-period"]').exists()).toBe(true);
    await next(wrapper);
    await next(wrapper); // currency: the display currency is already in it

    await wrapper.get('[data-testid="budget-chip-groceries"]').trigger('click');
    await wrapper.get('[data-testid="budget-custom"]').setValue('Няня');
    await wrapper.get('[data-testid="budget-custom-add"]').trigger('click');
    await next(wrapper);

    await wrapper.get('[data-testid="budget-limit-groceries"]').setValue('300');
    await wrapper.get('[data-testid="budget-limit-custom:няня"]').setValue('120');
    await next(wrapper);

    expect(wrapper.get('[data-testid="budget-summary"]').text()).toContain('Няня');
    await next(wrapper);
    await flushPromises();

    expect(posts).toHaveLength(2);
    expect(posts[0]).toMatchObject({ name: 'Продукты', icon: '🛒', monthlyLimit: '300' });
    expect(posts[1]).toMatchObject({ name: 'Няня', icon: null, monthlyLimit: '120' });
    expect(router.currentRoute.value.fullPath).toBe('/plan?tab=budgets');
    wrapper.unmount();
  });

  /* Going back is what makes it a wizard rather than five screens in a row. */
  it('keeps what was entered when a step is walked back to', async () => {
    const { wrapper } = await openWizard();
    await flushPromises();
    await next(wrapper);
    await next(wrapper);
    await wrapper.get('[data-testid="budget-chip-dining"]').trigger('click');
    await next(wrapper);
    await wrapper.get('[data-testid="budget-limit-dining"]').setValue('80');

    await wrapper.get('[data-testid="budget-back"]').trigger('click');
    expect(wrapper.get('[data-testid="budget-chip-dining"]').attributes('aria-pressed')).toBe(
      'true',
    );
    await next(wrapper);
    expect(
      (wrapper.get('[data-testid="budget-limit-dining"]').element as HTMLInputElement).value,
    ).toContain('80');
    wrapper.unmount();
  });

  it('will not move on from a step that is not finished', async () => {
    const { wrapper } = await openWizard();
    await flushPromises();
    await next(wrapper);
    await next(wrapper);
    /* Nothing picked: the pill is held, and the step stays where it is. */
    expect(wrapper.get('[data-testid="budget-next"]').attributes('disabled')).toBeDefined();
    await wrapper.get('[data-testid="budget-chip-groceries"]').trigger('click');
    expect(wrapper.get('[data-testid="budget-next"]').attributes('disabled')).toBeUndefined();
    await next(wrapper);
    /* A category with no limit holds the step the same way. */
    expect(wrapper.get('[data-testid="budget-next"]').attributes('disabled')).toBeDefined();
    wrapper.unmount();
  });

  it('says which step this is, and draws how far along it is', async () => {
    const { wrapper } = await openWizard();
    await flushPromises();
    const live = wrapper.get('[data-testid="budget-step-of"]');
    expect(live.attributes('aria-live')).toBe('polite');
    const bar = wrapper.get('[data-testid="budget-progress"]');
    expect(bar.attributes('role')).toBe('progressbar');
    expect(bar.attributes('aria-valuenow')).toBe('20');
    await next(wrapper);
    expect(wrapper.get('[data-testid="budget-progress"]').attributes('aria-valuenow')).toBe('40');
    expect(wrapper.find('[data-testid="budget-step-currency"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('asks before leaving a wizard that is carrying something', async () => {
    const { wrapper, router } = await openWizard();
    await flushPromises();
    await next(wrapper);
    await next(wrapper);
    await wrapper.get('[data-testid="budget-chip-groceries"]').trigger('click');

    void router.push('/plan');
    await flushPromises();
    const body = new DOMWrapper(document.body);
    expect(body.find('[data-testid="budget-leave"]').exists()).toBe(true);
    expect(router.currentRoute.value.path).toBe('/plan/budgets/new');
    await body.get('[data-testid="budget-leave"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/plan');
    wrapper.unmount();
  });

  it('lets an untouched wizard go without a word', async () => {
    const { wrapper, router } = await openWizard();
    await flushPromises();
    void router.push('/plan');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/plan');
    wrapper.unmount();
  });
});

describe('BudgetFormPage — one budget being edited', () => {
  it('says so when the budget being edited is not there', async () => {
    const { wrapper } = await mountAt(
      BudgetFormPage,
      '/plan/budgets/99999999-9999-4999-8999-999999999999/edit',
      apiOf(() => undefined),
    );
    await flushPromises();
    expect(wrapper.find('[data-testid="budget-form"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="budget-back-link"]').text()).toContain('Бюджеты');
    wrapper.unmount();
  });

  it('holds Save until there is a limit above zero', async () => {
    const { wrapper } = await mountAt(
      BudgetFormPage,
      `/plan/budgets/${ID}/edit`,
      apiOf((path) => (path.startsWith('/budgets') ? json([dto]) : undefined)),
    );
    await flushPromises();
    const submit = () => wrapper.get('[data-testid="budget-submit"]');
    expect(submit().attributes('disabled')).toBeUndefined();
    await wrapper.get('[data-testid="budget-limit"]').setValue('0');
    expect(submit().attributes('disabled')).toBeDefined();
    await wrapper.get('[data-testid="budget-limit"]').setValue('1000');
    expect(submit().attributes('disabled')).toBeUndefined();
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
