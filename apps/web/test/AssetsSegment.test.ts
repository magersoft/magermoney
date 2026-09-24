import { describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import SavingsPage from '../src/modules/savings/ui/SavingsPage.vue';
import { apiOf, json, mountAt } from './fixtures/income-mount.js';

const ID_A = '44444444-4444-4444-8444-444444444444';
const ID_B = '55555555-5555-4555-8555-555555555555';

const assetDto = (over: object = {}) => ({
  id: ID_A,
  name: 'BMW 530e',
  currency: 'USD',
  countsInTotal: true,
  acquiredOn: null,
  purchasePrice: null,
  archivedAt: null,
  value: '30000',
  valuedOn: '2026-09-01',
  ...over,
});

const mountWith = (assets: object[]) =>
  mountAt(
    SavingsPage,
    '/goals?tab=assets',
    apiOf((p) => {
      if (p === '/assets') return json(assets);
      if (p === '/goals') return json([]);
      return undefined;
    }),
    {},
    true,
  );

describe('AssetsSegment', () => {
  it('totals the assets marked for the capital and says at which rates', async () => {
    const { wrapper } = await mountWith([assetDto()]);
    await flushPromises();
    await flushPromises();

    expect(wrapper.get('[data-testid="assets-total"]').text()).toContain('30');
    expect(wrapper.get('[data-testid="assets-rate-note"]').text().length).toBeGreaterThan(0);
    wrapper.unmount();
  });

  it('marks an asset that stays out of the capital, and leaves it out of the total', async () => {
    const { wrapper } = await mountWith([
      assetDto({ id: ID_B, name: 'Часы', countsInTotal: false, value: '9000' }),
    ]);
    await flushPromises();
    await flushPromises();

    expect(wrapper.get(`[data-testid="asset-row-${ID_B}"]`).text()).toContain(
      'не входит в капитал',
    );
    expect(wrapper.get('[data-testid="assets-total"]').text()).toContain('0');
    wrapper.unmount();
  });

  it('does not pass an unvalued asset off as a zero', async () => {
    const { wrapper } = await mountWith([assetDto({ value: null, valuedOn: null })]);
    await flushPromises();
    await flushPromises();

    const row = wrapper.get(`[data-testid="asset-row-${ID_A}"]`).text();
    expect(row).toContain('Ещё не оценивали');
    expect(row).toContain('—');
    wrapper.unmount();
  });

  it('shows an error rather than an empty list when assets fail to load', async () => {
    const { wrapper } = await mountAt(
      SavingsPage,
      '/goals?tab=assets',
      apiOf((p) => {
        if (p === '/assets') return json({ code: 'internal', message: 'boom' }, 500);
        if (p === '/goals') return json([]);
        return undefined;
      }),
      {},
      true,
    );
    await flushPromises();
    await flushPromises();

    expect(wrapper.find('[data-testid="assets-error"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="assets-empty"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('leaves a deleted asset out of the list and out of the total', async () => {
    const { wrapper } = await mountWith([
      assetDto(),
      assetDto({ id: ID_B, name: 'Часы', value: '9000', archivedAt: '2026-09-24T10:00:00.000Z' }),
    ]);
    await flushPromises();
    await flushPromises();

    expect(wrapper.find(`[data-testid="asset-row-${ID_B}"]`).exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Часы');
    expect(wrapper.get('[data-testid="assets-total"]').text()).not.toContain('39');
    wrapper.unmount();
  });

  it('invites the first asset when there are none', async () => {
    const { wrapper } = await mountWith([]);
    await flushPromises();
    await flushPromises();

    expect(wrapper.get('[data-testid="assets-empty"]').text()).toContain('Пока ни одного актива');
    wrapper.unmount();
  });
});
