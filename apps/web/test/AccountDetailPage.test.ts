import { describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import AccountDetailPage from '../src/modules/accounts/ui/AccountDetailPage.vue';
import { acc, apiOf, json, mountAt } from './fixtures/income-mount.js';

vi.mock('@magermoney/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@magermoney/ui')>();
  return { ...actual, useToast: () => ({ toast: vi.fn() }) };
});

const ACCOUNT_ID = '33333333-3333-4333-8333-333333333333';
const LATEST = '99999999-9999-4999-8999-999999999999';
const OLDER = '22222222-2222-4222-8222-222222222222';
const INFLOW_ID = '88888888-8888-4888-8888-888888888888';
const entry = (id: string, amount: string, over: object = {}) => ({
  id,
  accountId: ACCOUNT_ID,
  amount,
  recordedAt: '2026-09-11T00:00:00.000Z',
  origin: 'manual' as const,
  transferId: null,
  inflowId: null,
  note: null,
  ...over,
});

const mountWith = (entries: ReturnType<typeof entry>[]) =>
  mountAt(
    AccountDetailPage,
    `/accounts/${ACCOUNT_ID}`,
    apiOf((path) => {
      if (path === '/accounts') return json([acc(ACCOUNT_ID, 'USD')]);
      if (path.startsWith(`/accounts/${ACCOUNT_ID}/balances`)) return json(entries);
      return undefined;
    }),
  );

describe('AccountDetailPage', () => {
  it('offers the edit on the latest entry only while a person wrote it', async () => {
    const { wrapper } = await mountWith([entry(LATEST, '100')]);
    await flushPromises();
    expect(
      wrapper.get(`[data-testid="balance-entry-${LATEST}"]`).attributes('disabled'),
    ).toBeUndefined();
    wrapper.unmount();
  });

  it('freezes the latest entry when an inflow wrote it — it is changed through that inflow', async () => {
    const { wrapper } = await mountWith([
      entry(LATEST, '600', { origin: 'inflow' as const, inflowId: INFLOW_ID }),
      entry(OLDER, '100'),
    ]);
    await flushPromises();
    expect(
      wrapper.get(`[data-testid="balance-entry-${LATEST}"]`).attributes('disabled'),
    ).toBeDefined();
    // Nor does the freeze hand the edit to the manual entry under it.
    expect(
      wrapper.get(`[data-testid="balance-entry-${OLDER}"]`).attributes('disabled'),
    ).toBeDefined();
    wrapper.unmount();
  });
});
