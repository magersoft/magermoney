import { describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import GoalPage from '../src/modules/goals/ui/GoalPage.vue';
import { acc, apiOf, json, mountAt } from './fixtures/income-mount.js';

const GOAL_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_GOAL = '99999999-9999-4999-8999-999999999999';
const ACC_A = '22222222-2222-4222-8222-222222222222';
const ACC_B = '33333333-3333-4333-8333-333333333333';

const goalDto = (id: string, name: string, over: object = {}) => ({
  id,
  name,
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

const mountGoal = (accounts: object[], goals = [goalDto(GOAL_ID, 'Машина')]) => {
  const patched: { path: string; body: unknown }[] = [];
  const fetch = apiOf((p, init) => {
    if (p === '/goals') return json(goals);
    if (p === '/accounts') return json(accounts);
    if (p.startsWith('/accounts/') && init?.method === 'PATCH') {
      patched.push({ path: p, body: JSON.parse(String(init.body)) });
      return json(acc(ACC_A, 'USD', { goalId: null }));
    }
    return undefined;
  });
  return mountAt(GoalPage, `/goals/${GOAL_ID}`, fetch, {}, true).then((m) => ({ ...m, patched }));
};

describe('linking accounts from the goal screen', () => {
  it('offers a free account and marks one another goal already holds', async () => {
    const { wrapper } = await mountGoal(
      [
        acc(ACC_A, 'USD', { goalId: null, name: 'Свободный' }),
        acc(ACC_B, 'USD', { goalId: OTHER_GOAL, name: 'Занятый' }),
      ],
      [goalDto(GOAL_ID, 'Машина'), goalDto(OTHER_GOAL, 'Велосипед')],
    );
    await flushPromises();
    await flushPromises();

    await wrapper.get('[data-testid="goal-link-open"]').trigger('click');
    await flushPromises();

    /* The sheet is teleported to the body, so it is not inside the wrapper. */
    const free = document.querySelector(`[data-testid="link-account-${ACC_A}"]`)!;
    const taken = document.querySelector(`[data-testid="link-account-${ACC_B}"]`)!;
    expect(free.hasAttribute('disabled')).toBe(false);
    expect(taken.hasAttribute('disabled')).toBe(true);
    expect(taken.textContent).toContain('Велосипед');
    wrapper.unmount();
  });

  it('names the reason when every account is already taken', async () => {
    const { wrapper } = await mountGoal(
      [acc(ACC_B, 'USD', { goalId: OTHER_GOAL, name: 'Занятый' })],
      [goalDto(GOAL_ID, 'Машина'), goalDto(OTHER_GOAL, 'Велосипед')],
    );
    await flushPromises();
    await flushPromises();

    await wrapper.get('[data-testid="goal-link-open"]').trigger('click');
    await flushPromises();

    expect(document.querySelector('[data-testid="link-none-free"]')?.textContent).toContain(
      'финансируют другие',
    );
    expect(document.querySelector('[data-testid="link-no-accounts"]')).toBeNull();
    wrapper.unmount();
  });

  it('releases a linked account by sending goalId: null', async () => {
    const { wrapper, patched } = await mountGoal([
      acc(ACC_A, 'USD', { goalId: GOAL_ID, name: 'Привязанный' }),
    ]);
    await flushPromises();
    await flushPromises();

    await wrapper.get(`[data-testid="goal-release-${ACC_A}"]`).trigger('click');
    await flushPromises();

    expect(patched).toHaveLength(1);
    expect(patched[0]!.path).toBe(`/accounts/${ACC_A}`);
    expect(patched[0]!.body).toEqual({ goalId: null });
    wrapper.unmount();
  });
});
