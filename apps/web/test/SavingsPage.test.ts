import { describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import SavingsPage from '../src/modules/savings/ui/SavingsPage.vue';
import { apiOf, json, mountAt } from './fixtures/income-mount.js';

const mountSavings = (at = '/goals') =>
  mountAt(
    SavingsPage,
    at,
    apiOf((p) => (p === '/goals' || p === '/assets' ? json([]) : undefined)),
    {},
    true,
  );

describe('SavingsPage', () => {
  it('names itself in the top bar and keeps its own heading for wide windows', async () => {
    const { wrapper } = await mountSavings();
    await flushPromises();
    expect(wrapper.get('[data-testid="page-title"]').text()).toBe('Цели');
    expect(wrapper.get('h1').classes()).toEqual(
      expect.arrayContaining(['sr-only', 'md:not-sr-only']),
    );
    wrapper.unmount();
  });

  it('opens on the goals segment and swaps the panel when the other is chosen', async () => {
    const { wrapper } = await mountSavings();
    await flushPromises();
    expect(wrapper.find('[data-testid="savings-segment-goals"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="savings-segment-assets"]').exists()).toBe(false);

    /* `tab-goals` is also the bottom nav's own test id, so the click is scoped
       to the screen's tab strip rather than looked up across the whole shell. */
    const strip = wrapper.get('[data-testid="savings-tabs"]');
    await strip.get('[data-testid="tab-assets"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="savings-segment-goals"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="savings-segment-assets"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('hands the bar action to whichever segment is showing', async () => {
    const { wrapper } = await mountSavings();
    await flushPromises();
    expect(wrapper.get('[data-testid="savings-add"]').attributes('aria-label')).toBe('Новая цель');

    const strip = wrapper.get('[data-testid="savings-tabs"]');
    await strip.get('[data-testid="tab-assets"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-testid="savings-add"]').attributes('aria-label')).toBe('Новый актив');
    wrapper.unmount();
  });

  it('says what an empty goals list means, rather than showing nothing', async () => {
    const { wrapper } = await mountSavings();
    await flushPromises();
    expect(wrapper.get('[data-testid="goals-empty"]').text()).toContain('Пока ни одной цели');
    wrapper.unmount();
  });

  it('shows an error rather than an empty list when goals fail to load', async () => {
    const { wrapper } = await mountAt(
      SavingsPage,
      '/goals',
      apiOf((p) => (p === '/goals' ? json({ code: 'internal', message: 'boom' }, 500) : undefined)),
      {},
      true,
    );
    await flushPromises();
    await flushPromises();
    expect(wrapper.find('[data-testid="goals-error"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="goals-empty"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
