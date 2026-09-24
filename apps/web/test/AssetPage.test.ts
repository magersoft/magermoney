import { describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises } from '@vue/test-utils';
import AssetPage from '../src/modules/assets/ui/AssetPage.vue';
import { apiOf, json, mountAt } from './fixtures/income-mount.js';

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('@magermoney/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@magermoney/ui')>();
  return { ...actual, useToast: () => ({ toast }) };
});

const ID = '44444444-4444-4444-8444-444444444444';

const assetDto = (over: object = {}) => ({
  id: ID,
  name: 'BMW 530e',
  icon: null,
  color: null,
  currency: 'USD',
  countsInTotal: true,
  acquiredOn: null,
  purchasePrice: null,
  archivedAt: null,
  value: '30000',
  valuedOn: '2026-09-01',
  ...over,
});

const body = () => new DOMWrapper(document.body);

const mountAsset = (refuse = false) => {
  const writes: { method: string; path: string; body: unknown }[] = [];
  const fetch = apiOf((p, init) => {
    const method = init?.method ?? 'GET';
    if (method !== 'GET') {
      writes.push({ method, path: p, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (refuse) return json({ error: { code: 'internal', message: 'boom' } }, 500);
      return json(assetDto({ archivedAt: '2026-09-24T10:00:00.000Z' }));
    }
    if (p === '/assets') return json([assetDto()]);
    if (p === `/assets/${ID}/valuations`) return json([]);
    return undefined;
  });
  return mountAt(AssetPage, `/assets/${ID}`, fetch, {}, true).then((m) => ({ ...m, writes }));
};

const settle = async () => {
  for (let i = 0; i < 4; i++) await flushPromises();
};

describe('deleting an asset', () => {
  it('is a button, and asks first, saying the valuations go out of sight', async () => {
    const { wrapper, writes } = await mountAsset();
    await settle();

    const open = wrapper.get('[data-testid="asset-delete"]');
    expect(open.element.tagName).toBe('BUTTON');
    expect(open.text()).toBe('Удалить актив');
    await open.trigger('click');
    await flushPromises();

    const dialog = body().get('[role="alertdialog"]');
    expect(dialog.text()).toContain('Удалить «BMW 530e»?');
    expect(dialog.text()).toContain('Историю оценок');
    expect(writes).toEqual([]);
    wrapper.unmount();
  });

  it('sends nothing when the confirmation is cancelled', async () => {
    const { wrapper, writes, router } = await mountAsset();
    await settle();
    await wrapper.get('[data-testid="asset-delete"]').trigger('click');
    await flushPromises();
    await body().get('[data-testid="asset-delete-cancel"]').trigger('click');
    await settle();

    expect(writes).toEqual([]);
    expect(router.currentRoute.value.fullPath).toBe(`/assets/${ID}`);
    wrapper.unmount();
  });

  it('archives rather than deletes, and goes back to the assets list', async () => {
    const { wrapper, writes, router } = await mountAsset();
    await settle();
    await wrapper.get('[data-testid="asset-delete"]').trigger('click');
    await flushPromises();
    await body().get('[data-testid="asset-delete-confirm"]').trigger('click');
    await settle();

    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ method: 'PATCH', path: `/assets/${ID}` });
    expect(writes[0]?.body).toHaveProperty('archivedAt');
    expect(router.currentRoute.value.fullPath).toBe('/goals?tab=assets');
    wrapper.unmount();
  });

  it('stays put and says so when the server refuses', async () => {
    toast.error.mockClear();
    const { wrapper, router } = await mountAsset(true);
    await settle();
    await wrapper.get('[data-testid="asset-delete"]').trigger('click');
    await flushPromises();
    await body().get('[data-testid="asset-delete-confirm"]').trigger('click');
    await settle();

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(router.currentRoute.value.fullPath).toBe(`/assets/${ID}`);
    expect(wrapper.find(`[data-testid="asset-row-${ID}"]`).exists()).toBe(true);
    wrapper.unmount();
  });
});
