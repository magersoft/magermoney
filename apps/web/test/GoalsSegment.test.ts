import { describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import SavingsPage from '../src/modules/savings/ui/SavingsPage.vue';
import { acc, apiOf, json, mountAt } from './fixtures/income-mount.js';

const GOAL_ID = '11111111-1111-4111-8111-111111111111';
/* Account ids are uuids in the contract, so a short stub fails the client parse. */
const ACC_A = '22222222-2222-4222-8222-222222222222';
const ACC_B = '33333333-3333-4333-8333-333333333333';

const goalDto = (over: object = {}) => ({
  id: GOAL_ID,
  name: 'Машина',
  icon: null,
  color: null,
  targetAmount: '10000',
  currency: 'USD',
  targetDate: null,
  achievedAt: null,
  archivedAt: null,
  sortOrder: 0,
  ...over,
});

/** Two months of rising closing balances: enough history for a pace. */
const journal = [
  { id: 'b2', accountId: ACC_A, amount: '3000', recordedAt: '2026-09-01T00:00:00.000Z' },
  { id: 'b1', accountId: ACC_A, amount: '1000', recordedAt: '2026-08-01T00:00:00.000Z' },
].map((e) => ({ ...e, origin: 'manual', transferId: null, inflowId: null, note: null }));

const mountWith = (goals: object[], accounts: object[], balances = journal) =>
  mountAt(
    SavingsPage,
    '/goals',
    apiOf((p) => {
      if (p === '/goals') return json(goals);
      if (p === '/assets') return json([]);
      if (p === '/accounts') return json(accounts);
      if (p.startsWith('/accounts/') && p.includes('/balances')) return json(balances);
      return undefined;
    }),
    {},
    true,
  );

describe('GoalsSegment', () => {
  it('shows what is left, what is saved against the target, and a forecast line', async () => {
    const { wrapper } = await mountWith(
      [goalDto()],
      [acc(ACC_A, 'USD', { goalId: GOAL_ID, balance: '3000' })],
    );
    await flushPromises();
    await flushPromises();
    await flushPromises();
    await flushPromises();

    expect(wrapper.get(`[data-testid="goal-remaining-${GOAL_ID}"]`).text()).toContain('7');
    expect(wrapper.get(`[data-testid="goal-of-${GOAL_ID}"]`).text()).toContain('3000');
    expect(wrapper.get(`[data-testid="goal-of-${GOAL_ID}"]`).text()).toContain('10000');
    expect(wrapper.get(`[data-testid="goal-forecast-${GOAL_ID}"]`).text().length).toBeGreaterThan(
      0,
    );
    wrapper.unmount();
  });

  it('says why there is no forecast rather than leaving the line empty', async () => {
    // A linked account with no journal reads as six flat months: from what the
    // app knows, the balance is standing still, which is a reason, not a gap.
    const { wrapper } = await mountWith(
      [goalDto()],
      [acc(ACC_A, 'USD', { goalId: GOAL_ID, balance: '3000' })],
      [],
    );
    await flushPromises();
    await flushPromises();
    await flushPromises();
    await flushPromises();

    const line = wrapper.get(`[data-testid="goal-forecast-${GOAL_ID}"]`).text();
    expect(line).not.toBe('');
    expect(line).toContain('не растёт');
    wrapper.unmount();
  });

  it('calls a goal reached rather than forecasting one that is already closed', async () => {
    const { wrapper } = await mountWith(
      [goalDto({ achievedAt: '2026-09-01T00:00:00.000Z' })],
      [acc(ACC_A, 'USD', { goalId: GOAL_ID, balance: '12000' })],
    );
    await flushPromises();
    await flushPromises();
    await flushPromises();
    await flushPromises();

    expect(wrapper.find('[data-testid="goal-achieved"]').exists()).toBe(true);
    expect(wrapper.get(`[data-testid="goal-forecast-${GOAL_ID}"]`).text()).toContain('закрыта');
    wrapper.unmount();
  });

  it('names an account it cannot price instead of counting it as nothing', async () => {
    const { wrapper } = await mountWith(
      [goalDto()],
      [
        acc(ACC_A, 'USD', { goalId: GOAL_ID, balance: '1000' }),
        acc(ACC_B, 'BTC', { goalId: GOAL_ID, balance: '1' }),
      ],
    );
    await flushPromises();
    await flushPromises();
    await flushPromises();
    await flushPromises();

    expect(wrapper.get(`[data-testid="goal-unconvertible-${GOAL_ID}"]`).text()).toContain(
      'Acc BTC',
    );
    wrapper.unmount();
  });

  it('leaves a deleted goal out of the list', async () => {
    const { wrapper } = await mountWith(
      [goalDto({ archivedAt: '2026-09-24T10:00:00.000Z' })],
      [acc(ACC_A, 'USD')],
    );
    await flushPromises();
    await flushPromises();

    expect(wrapper.find(`[data-testid="goal-card-${GOAL_ID}"]`).exists()).toBe(false);
    expect(wrapper.find('[data-testid="goals-empty"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('marks a goal with its emoji and colour, and an unmarked one with its first letter', async () => {
    const OTHER = '44444444-4444-4444-8444-444444444444';
    const { wrapper } = await mountWith(
      [goalDto({ icon: '🚗', color: 'teal' }), goalDto({ id: OTHER, name: 'отпуск' })],
      [],
    );
    await flushPromises();
    await flushPromises();

    const marked = wrapper.get(`[data-testid="goal-card-${GOAL_ID}"] [data-slot="mark-disc"]`);
    expect(marked.text()).toBe('🚗');
    expect(marked.attributes('data-color')).toBe('teal');
    const plain = wrapper.get(`[data-testid="goal-card-${OTHER}"] [data-slot="mark-disc"]`);
    expect(plain.text()).toBe('О');
    expect(plain.attributes('data-color')).toBeUndefined();
    wrapper.unmount();
  });
});
