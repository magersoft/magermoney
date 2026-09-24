import { describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises } from '@vue/test-utils';
import GoalPage from '../src/modules/goals/ui/GoalPage.vue';
import { acc, apiOf, json, mountAt } from './fixtures/income-mount.js';

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('@magermoney/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@magermoney/ui')>();
  return { ...actual, useToast: () => ({ toast }) };
});

const GOAL_ID = '11111111-1111-4111-8111-111111111111';
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

const body = () => new DOMWrapper(document.body);

/**
 * `refuse` answers the goal's PATCH with a server error. Every write is
 * recorded, so a test can say both what was sent and what never was.
 */
const mountGoal = (accounts: object[], refuse = false) => {
  const writes: { method: string; path: string; body: unknown }[] = [];
  let goals = [goalDto()];
  const fetch = apiOf((p, init) => {
    const method = init?.method ?? 'GET';
    if (method !== 'GET') {
      writes.push({ method, path: p, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (refuse) return json({ error: { code: 'internal', message: 'boom' } }, 500);
      goals = [goalDto({ archivedAt: '2026-09-24T10:00:00.000Z' })];
      return json(goals[0]);
    }
    if (p === '/goals') return json(goals);
    if (p === '/accounts') return json(accounts);
    return undefined;
  });
  return mountAt(GoalPage, `/goals/${GOAL_ID}`, fetch, {}, true).then((m) => ({ ...m, writes }));
};

const settle = async () => {
  for (let i = 0; i < 4; i++) await flushPromises();
};

describe('deleting a goal', () => {
  it('is a button, and asks first, naming how many accounts it lets go', async () => {
    const { wrapper, writes } = await mountGoal([
      acc(ACC_A, 'USD', { goalId: GOAL_ID }),
      acc(ACC_B, 'EUR', { goalId: GOAL_ID }),
    ]);
    await settle();

    const open = wrapper.get('[data-testid="goal-delete"]');
    expect(open.element.tagName).toBe('BUTTON');
    expect(open.text()).toBe('Удалить цель');
    await open.trigger('click');
    await flushPromises();

    const dialog = body().get('[role="alertdialog"]');
    expect(dialog.text()).toContain('Удалить «Машина»?');
    expect(dialog.text()).toContain('2 счёта');
    expect(writes).toEqual([]);
    wrapper.unmount();
  });

  it('says the goal holds no accounts when it holds none', async () => {
    const { wrapper } = await mountGoal([acc(ACC_A, 'USD')]);
    await settle();
    await wrapper.get('[data-testid="goal-delete"]').trigger('click');
    await flushPromises();
    expect(body().get('[role="alertdialog"]').text()).toContain('Счетов у цели нет');
    wrapper.unmount();
  });

  it('sends nothing when the confirmation is cancelled', async () => {
    const { wrapper, writes, router } = await mountGoal([acc(ACC_A, 'USD', { goalId: GOAL_ID })]);
    await settle();
    await wrapper.get('[data-testid="goal-delete"]').trigger('click');
    await flushPromises();
    await body().get('[data-testid="goal-delete-cancel"]').trigger('click');
    await settle();

    expect(writes).toEqual([]);
    expect(router.currentRoute.value.fullPath).toBe(`/goals/${GOAL_ID}`);
    expect(body().find('[role="alertdialog"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('archives rather than deletes, and goes back to the savings list', async () => {
    const { wrapper, writes, router } = await mountGoal([acc(ACC_A, 'USD', { goalId: GOAL_ID })]);
    await settle();
    await wrapper.get('[data-testid="goal-delete"]').trigger('click');
    await flushPromises();
    await body().get('[data-testid="goal-delete-confirm"]').trigger('click');
    await settle();

    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ method: 'PATCH', path: `/goals/${GOAL_ID}` });
    expect(writes[0]?.body).toHaveProperty('archivedAt');
    expect(writes.some((w) => w.method === 'DELETE')).toBe(false);
    expect(router.currentRoute.value.fullPath).toBe('/goals');
    wrapper.unmount();
  });

  it('stays put and says so when the server refuses', async () => {
    toast.error.mockClear();
    const { wrapper, router } = await mountGoal([acc(ACC_A, 'USD', { goalId: GOAL_ID })], true);
    await settle();
    await wrapper.get('[data-testid="goal-delete"]').trigger('click');
    await flushPromises();
    await body().get('[data-testid="goal-delete-confirm"]').trigger('click');
    await settle();

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(router.currentRoute.value.fullPath).toBe(`/goals/${GOAL_ID}`);
    expect(wrapper.find(`[data-testid="goal-card-${GOAL_ID}"]`).exists()).toBe(true);
    wrapper.unmount();
  });

  it('no longer offers the old archive wording', async () => {
    const { wrapper } = await mountGoal([]);
    await settle();
    expect(wrapper.text()).not.toContain('архив');
    expect(wrapper.find('[data-testid="goal-archive"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
