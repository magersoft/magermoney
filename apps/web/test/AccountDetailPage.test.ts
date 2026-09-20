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

/*
 * The screen opens on the month it is read in, so the journal is written
 * against today rather than against a date that would leave the month a year
 * from now. Local noon keeps every entry on its own day in any time zone.
 */
const now = new Date();
const day = (dayOfMonth: number, monthsBack = 0, hour = 12) =>
  new Date(now.getFullYear(), now.getMonth() - monthsBack, dayOfMonth, hour).toISOString();
const isoDay = (recordedAt: string) => recordedAt.slice(0, 10);

const entry = (id: string, amount: string, recordedAt: string, over: object = {}) => ({
  id,
  accountId: ACCOUNT_ID,
  amount,
  recordedAt,
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

/* A month with all three kinds of movement on it, newest first. */
const journal = [
  entry(LATEST, '1500', day(20), {
    origin: 'transfer',
    transferId: '44444444-4444-4444-8444-444444444444',
  }),
  entry(INFLOW_ID, '1700', day(20, 0, 9), {
    origin: 'inflow',
    inflowId: '55555555-5555-4555-8555-555555555555',
    note: 'Аванс',
  }),
  entry(OLDER, '1000', day(5)),
  entry('11111111-1111-4111-8111-111111111111', '900', day(18, 1)),
];

describe('AccountDetailPage', () => {
  it('reads the month as movements grouped by the day they fell on', async () => {
    const { wrapper } = await mountWith(journal);
    await flushPromises();

    const first = wrapper.get(`[data-testid="account-day-${isoDay(day(20))}"]`);
    expect(first.findAll('[data-slot="transaction-row"]')).toHaveLength(2);
    /* −200 and +700 on the same day: the heading adds them up and keeps the sign. */
    expect(first.get('[data-slot="row-group-subtotal"]').text()).toContain('+');
    expect(first.get('[data-slot="row-group-subtotal"]').text()).toContain('500');
    expect(wrapper.find(`[data-testid="account-day-${isoDay(day(5))}"]`).exists()).toBe(true);
    wrapper.unmount();
  });

  it('splits the month by where the money came from, and says what came in and went out', async () => {
    const { wrapper } = await mountWith(journal);
    await flushPromises();

    const legend = wrapper.findAll('[data-slot="donut-legend-chip"]');
    expect(legend.map((c) => c.attributes('data-segment-id'))).toEqual([
      'inflow',
      'transfer',
      'manual',
    ]);
    expect(wrapper.get('[data-testid="account-incoming"]').text()).toContain('800');
    expect(wrapper.get('[data-testid="account-outgoing"]').text()).toContain('200');
    wrapper.unmount();
  });

  it('narrows the list to the slice that was picked, and says so with a chip that drops it', async () => {
    const { wrapper } = await mountWith(journal);
    await flushPromises();

    await wrapper.get('[data-slot="donut-legend-chip"][data-segment-id="inflow"]').trigger('click');
    expect(wrapper.findAll('[data-slot="transaction-row"]')).toHaveLength(1);
    const chip = wrapper.get('[data-testid="account-filters"]');
    expect(chip.text()).toContain('Поступление');

    await chip.get('[data-slot="filter-chip-remove"]').trigger('click');
    expect(wrapper.findAll('[data-slot="transaction-row"]')).toHaveLength(3);
    wrapper.unmount();
  });

  it('pages the month with the ring and names the one it landed on as a filter', async () => {
    const { wrapper } = await mountWith(journal);
    await flushPromises();

    await wrapper.get('[data-slot="donut-prev"]').trigger('click');
    /* Last month holds the account's first entry: 900 arriving. */
    expect(wrapper.get('[data-testid="account-incoming"]').text()).toContain('900');
    expect(wrapper.find('[data-testid="account-filters"]').exists()).toBe(true);

    await wrapper
      .get('[data-testid="account-filters"] [data-slot="filter-chip-remove"]')
      .trigger('click');
    expect(wrapper.get('[data-testid="account-incoming"]').text()).toContain('800');
    wrapper.unmount();
  });

  it('changes the month only once the sheet is applied', async () => {
    const { wrapper } = await mountWith(journal);
    await flushPromises();

    await wrapper.get('[data-testid="account-period-open"]').trigger('click');
    await flushPromises();
    const sheet = document.body;
    /* A year back, where this journal has nothing, whichever month today is in. */
    (sheet.querySelector('[data-testid="period-prev-year"]') as HTMLButtonElement).click();
    await flushPromises();
    (sheet.querySelector('[data-testid="period-month-1"]') as HTMLButtonElement).click();
    await flushPromises();
    /* Picked, not applied: the screen is still reading the month it opened on. */
    expect(wrapper.get('[data-testid="account-incoming"]').text()).toContain('800');

    (sheet.querySelector('[data-testid="period-apply"]') as HTMLButtonElement).click();
    await flushPromises();
    expect(wrapper.find('[data-testid="account-empty-period"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('tells a quiet month apart from an account that was never written down', async () => {
    const quiet = await mountWith([entry(OLDER, '1000', day(18, 2))]);
    await flushPromises();
    expect(quiet.wrapper.find('[data-testid="account-empty-period"]').exists()).toBe(true);
    expect(quiet.wrapper.find('[data-testid="account-no-history"]').exists()).toBe(false);
    quiet.wrapper.unmount();

    const blank = await mountWith([]);
    await flushPromises();
    expect(blank.wrapper.find('[data-testid="account-no-history"]').exists()).toBe(true);
    expect(blank.wrapper.find('[data-testid="account-empty-period"]').exists()).toBe(false);
    blank.wrapper.unmount();
  });

  it('offers the edit on the latest entry only while a person wrote it', async () => {
    const { wrapper } = await mountWith([entry(LATEST, '100', day(5))]);
    await flushPromises();
    expect(wrapper.get(`[data-testid="balance-entry-${LATEST}"]`).element.tagName).toBe('BUTTON');
    wrapper.unmount();
  });

  it('freezes the latest entry when an inflow wrote it — it is changed through that inflow', async () => {
    const { wrapper } = await mountWith([
      entry(LATEST, '600', day(6), { origin: 'inflow', inflowId: INFLOW_ID }),
      entry(OLDER, '100', day(5)),
    ]);
    await flushPromises();
    expect(wrapper.get(`[data-testid="balance-entry-${LATEST}"]`).element.tagName).toBe('DIV');
    // Nor does the freeze hand the edit to the manual entry under it.
    expect(wrapper.get(`[data-testid="balance-entry-${OLDER}"]`).element.tagName).toBe('DIV');
    wrapper.unmount();
  });

  /*
   * The star is the whole way an account gets onto Home, so it has to be both
   * the switch and the readout: one tap patches the account, and the button
   * says which way it now stands.
   */
  it('puts the account on Home with the star, and says so afterwards', async () => {
    const account = acc(ACCOUNT_ID, 'USD');
    const fetch = vi.fn(
      apiOf((path, init) => {
        if (path === `/accounts/${ACCOUNT_ID}` && init?.method === 'PATCH') {
          const patch = JSON.parse(String(init.body)) as { isPinned: boolean };
          Object.assign(account, patch);
          return json(account);
        }
        if (path === '/accounts') return json([account]);
        if (path.startsWith(`/accounts/${ACCOUNT_ID}/balances`)) return json([]);
        return undefined;
      }),
    );
    const { wrapper } = await mountAt(AccountDetailPage, `/accounts/${ACCOUNT_ID}`, fetch);
    await flushPromises();

    const star = wrapper.get('[data-testid="account-pin"]');
    expect(star.attributes('aria-pressed')).toBe('false');
    expect(star.attributes('aria-label')).toBe('Показывать на главной');

    await star.trigger('click');
    await flushPromises();

    const patch = fetch.mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ isPinned: true });
    expect(star.attributes('aria-pressed')).toBe('true');
    expect(star.attributes('aria-label')).toBe('Убрать с главной');
    wrapper.unmount();
  });
});
