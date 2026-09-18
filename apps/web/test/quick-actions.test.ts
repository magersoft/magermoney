import { describe, expect, it } from 'vitest';
import { DOMWrapper, flushPromises } from '@vue/test-utils';
import QuickActions from '../src/app/QuickActions.vue';
import { acc, apiOf, json, mountAt } from './fixtures/income-mount.js';

describe('QuickActions', () => {
  it('offers the inflow even before there is an account, and the account actions only once there is one', async () => {
    const { wrapper } = await mountAt(
      QuickActions,
      '/',
      apiOf(() => undefined),
    );
    await flushPromises();
    await wrapper.get('[data-testid="fab"]').trigger('click');
    const body = new DOMWrapper(document.body);
    expect(body.find('[data-testid="quick-inflow"]').exists()).toBe(true);
    expect(body.find('[data-testid="quick-record"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('keeps all three actions on home when accounts exist, and hides the button elsewhere', async () => {
    const fetch = apiOf((p) =>
      p === '/accounts' ? json([acc('33333333-3333-4333-8333-333333333333', 'USD')]) : undefined,
    );
    const home = await mountAt(QuickActions, '/', fetch);
    await flushPromises();
    await home.wrapper.get('[data-testid="fab"]').trigger('click');
    const body = new DOMWrapper(document.body);
    for (const id of ['quick-record', 'quick-transfer', 'quick-inflow'])
      expect(body.find(`[data-testid="${id}"]`).exists()).toBe(true);
    home.wrapper.unmount();

    const plan = await mountAt(QuickActions, '/plan', fetch);
    await flushPromises();
    expect(plan.wrapper.find('[data-testid="fab"]').exists()).toBe(false);
    plan.wrapper.unmount();
  });
});
