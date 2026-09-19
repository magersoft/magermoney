import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises } from '@vue/test-utils';
import QuickActions from '../src/app/QuickActions.vue';
import { acc, apiOf, json, mountAt } from './fixtures/income-mount.js';

/** The inflow sheet is the one lazy child here; a deploy can take its chunk away mid-session. */
vi.mock('@/modules/income', () => {
  throw new Error('Failed to fetch dynamically imported module');
});

afterEach(() => vi.restoreAllMocks());

describe('QuickActions', () => {
  it('offers the inflow even before there is an account, and the account actions only once there is one', async () => {
    const { wrapper } = await mountAt(
      QuickActions,
      '/',
      apiOf(() => undefined),
      { props: { open: true } },
    );
    await flushPromises();
    const body = new DOMWrapper(document.body);
    expect(body.find('[data-testid="quick-inflow"]').exists()).toBe(true);
    expect(body.find('[data-testid="quick-record"]').exists()).toBe(false);
    wrapper.unmount();
  });

  /**
   * The menu is now opened from the navigation pill's "+", which is on every
   * screen — so the actions have to be there on every screen too. The floating
   * button is the wide window's trigger only, and it keeps its two screens.
   */
  it('keeps all three actions wherever the menu is opened from, and the floating button to its two screens', async () => {
    const fetch = apiOf((p) =>
      p === '/accounts' ? json([acc('33333333-3333-4333-8333-333333333333', 'USD')]) : undefined,
    );
    const plan = await mountAt(QuickActions, '/plan', fetch, { props: { open: true } });
    await flushPromises();
    const body = new DOMWrapper(document.body);
    for (const id of ['quick-record', 'quick-transfer', 'quick-inflow'])
      expect(body.find(`[data-testid="${id}"]`).exists()).toBe(true);
    expect(plan.wrapper.find('[data-testid="fab"]').exists()).toBe(false);
    plan.wrapper.unmount();

    const home = await mountAt(QuickActions, '/', fetch);
    await flushPromises();
    await home.wrapper.get('[data-testid="fab"]').trigger('click');
    expect(new DOMWrapper(document.body).find('[data-testid="quick-record"]').exists()).toBe(true);
    home.wrapper.unmount();
  });

  it('offers a reload instead of nothing when the inflow sheet chunk is gone', async () => {
    // Vue warns about the rejected loader; that warning is the point of the test.
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { wrapper } = await mountAt(
      QuickActions,
      '/',
      apiOf(() => undefined),
      { props: { open: true } },
    );
    await flushPromises();
    await new DOMWrapper(document.body).get('[data-testid="quick-inflow"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('Обновить страницу');
    wrapper.unmount();
  });
});
