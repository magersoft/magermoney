import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises } from '@vue/test-utils';
import QuickActions from '../src/app/QuickActions.vue';
import { acc, apiOf, json, mountAt } from './fixtures/income-mount.js';

/** The inflow form is the one lazy segment here; a deploy can take its chunk away mid-session. */
vi.mock('@/modules/income', () => {
  throw new Error('Failed to fetch dynamically imported module');
});

afterEach(() => vi.restoreAllMocks());

const body = () => new DOMWrapper(document.body);

describe('QuickActions', () => {
  /**
   * The "+" used to open a menu, which put a tap in front of every operation.
   * It now opens the sheet itself, with the kind of operation as a segment in
   * it — one tap from anywhere to writing an expense down.
   */
  it('opens the operation sheet itself, on the expense the segment offers first', async () => {
    const { wrapper } = await mountAt(
      QuickActions,
      '/plan',
      apiOf(() => undefined),
      { props: { open: true } },
    );
    await flushPromises();
    expect(body().find('[data-slot="quick-action-sheet"]').exists()).toBe(true);
    expect(body().find('[data-testid="expense-form"]').exists()).toBe(true);
    const segment = body().get('[data-slot="segmented-control"]');
    expect(segment.findAll('[role="radio"]').map((r) => r.attributes('data-value'))).toEqual([
      'transfer',
      'expense',
      'inflow',
    ]);
    wrapper.unmount();
  });

  it('switches the whole form when another kind of operation is picked', async () => {
    const { wrapper } = await mountAt(
      QuickActions,
      '/plan',
      apiOf(() => undefined),
      { props: { open: true } },
    );
    await flushPromises();
    await body().get('[data-testid="segment-transfer"]').trigger('click');
    await flushPromises();
    expect(body().find('[data-testid="transfer-form"]').exists()).toBe(true);
    expect(body().find('[data-testid="expense-form"]').exists()).toBe(false);
    wrapper.unmount();
  });

  /**
   * An income source is set up once and rarely touched again, so it sits below
   * the form, where the inflow used to be. What an account holds now stays
   * there too, once there is an account to hold it.
   */
  it('keeps a new income source beside the form, and the balance only once there is an account', async () => {
    const { wrapper } = await mountAt(
      QuickActions,
      '/',
      apiOf(() => undefined),
      { props: { open: true } },
    );
    await flushPromises();
    expect(body().find('[data-testid="quick-inflow"]').exists()).toBe(false);
    expect(body().find('[data-testid="quick-income-source"]').exists()).toBe(true);
    expect(body().find('[data-testid="quick-record"]').exists()).toBe(false);
    wrapper.unmount();

    const withAccount = await mountAt(
      QuickActions,
      '/',
      apiOf((p) =>
        p === '/accounts' ? json([acc('33333333-3333-4333-8333-333333333333', 'USD')]) : undefined,
      ),
      { props: { open: true } },
    );
    await flushPromises();
    expect(body().find('[data-testid="quick-record"]').exists()).toBe(true);
    withAccount.wrapper.unmount();
  });

  it('takes a new income source to its own form, and closes the sheet on the way', async () => {
    const { wrapper, router } = await mountAt(
      QuickActions,
      '/',
      apiOf(() => undefined),
      { props: { open: true } },
    );
    await flushPromises();
    await body().get('[data-testid="quick-income-source"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/plan/income/new');
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false]);
    wrapper.unmount();
  });

  /** The floating button is the wide window's trigger only, and it keeps its two screens. */
  it('shows the floating button on the two screens about money on hand, and nowhere else', async () => {
    const fetch = apiOf((p) =>
      p === '/accounts' ? json([acc('33333333-3333-4333-8333-333333333333', 'USD')]) : undefined,
    );
    const plan = await mountAt(QuickActions, '/plan', fetch);
    await flushPromises();
    expect(plan.wrapper.find('[data-testid="fab"]').exists()).toBe(false);
    plan.wrapper.unmount();

    const home = await mountAt(QuickActions, '/', fetch);
    await flushPromises();
    await home.wrapper.get('[data-testid="fab"]').trigger('click');
    await flushPromises();
    expect(body().find('[data-slot="quick-action-sheet"]').exists()).toBe(true);
    home.wrapper.unmount();
  });

  it('offers a reload instead of nothing when the inflow form chunk is gone', async () => {
    // Vue warns about the rejected loader; that warning is the point of the test.
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { wrapper } = await mountAt(
      QuickActions,
      '/',
      apiOf(() => undefined),
      { props: { open: true } },
    );
    await flushPromises();
    await body().get('[data-testid="segment-inflow"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('Обновить страницу');
    wrapper.unmount();
  });
});
