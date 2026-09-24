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
   * The sheet writes one operation. A new income source and a balance typed in
   * by hand have their own homes — Plan → Income and the account's screen — so
   * nothing below the form competes with the button it exists for.
   */
  it('offers nothing below the form in any segment', async () => {
    const { wrapper } = await mountAt(
      QuickActions,
      '/',
      apiOf((p) =>
        p === '/accounts' ? json([acc('33333333-3333-4333-8333-333333333333', 'USD')]) : undefined,
      ),
      { props: { open: true } },
    );
    await flushPromises();
    for (const kind of ['transfer', 'expense']) {
      await body().get(`[data-testid="segment-${kind}"]`).trigger('click');
      await flushPromises();
      expect(body().find('[data-slot="quick-action-secondary"]').exists()).toBe(false);
      expect(body().find('[data-testid="quick-income-source"]').exists()).toBe(false);
      expect(body().find('[data-testid="quick-record"]').exists()).toBe(false);
    }
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
