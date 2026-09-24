import { describe, expect, it } from 'vitest';
import { updateGoal } from '../../src/modules/goals/application/goals.js';
import type { Repos } from '../../src/app.js';
import type { UnitOfWork } from '../../src/shared/db/unit-of-work.js';
import { deps, newUser, sql, usd } from './helpers.js';

const { repos } = deps;
const ARCHIVED_AT = '2026-09-21T10:00:00.000Z';

async function seedLinkedGoal(tag: string) {
  const uid = await newUser(tag);
  const goal = await repos.goals.insert(uid, {
    name: 'Car',
    icon: null,
    color: null,
    targetAmount: '10000',
    currency: 'USD',
    targetDate: null,
    achievedAt: null,
    archivedAt: null,
    sortOrder: 0,
  });
  const account = await repos.accounts.create(uid, usd('savings'));
  await repos.accounts.setGoal(uid, account.id, goal.id);
  return { uid, goal, account };
}

/**
 * The same transaction the real unit of work opens, with one repository swapped
 * for a version that throws. Whatever the goal write did must go with it.
 */
const uowFailingOn =
  (which: 'clearGoal'): UnitOfWork<Repos> =>
  (fn) =>
    deps.uow((r) =>
      fn({
        ...r,
        accounts: new Proxy(r.accounts, {
          get(target, prop, receiver) {
            if (prop === which)
              return async () => {
                throw new Error(`${which} failed`);
              };
            const value = Reflect.get(target, prop, receiver) as unknown;
            return typeof value === 'function' ? (value as () => unknown).bind(target) : value;
          },
        }),
      }),
    );

describe('archiving a goal', () => {
  it('stamps it and releases its accounts in one transaction', async () => {
    const { uid, goal, account } = await seedLinkedGoal('arch');
    const res = await updateGoal(deps)(uid, goal.id, { archivedAt: ARCHIVED_AT });
    expect(res.isOk()).toBe(true);

    const [row] = await sql<{ goalId: string | null }[]>`
      select goal_id from accounts where id = ${account.id}`;
    expect(row!.goalId).toBeNull();
  });

  it('leaves both untouched when the release fails', async () => {
    const { uid, goal, account } = await seedLinkedGoal('arch-fail');
    const failing = { ...deps, uow: uowFailingOn('clearGoal') };

    await expect(updateGoal(failing)(uid, goal.id, { archivedAt: ARCHIVED_AT })).rejects.toThrow(
      'clearGoal failed',
    );

    const [g] = await sql<{ archivedAt: Date | null }[]>`
      select archived_at from goals where id = ${goal.id}`;
    const [a] = await sql<{ goalId: string | null }[]>`
      select goal_id from accounts where id = ${account.id}`;
    expect(g!.archivedAt).toBeNull();
    expect(a!.goalId).toBe(goal.id);
  });
});
