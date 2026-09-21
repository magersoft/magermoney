import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { testDeps } from './helpers/deps.js';
import { authed, SECRET } from './helpers/http.js';

const mk = () => createApp(testDeps({ jwtSecret: SECRET }));
const car = { name: 'Car', targetAmount: '10000', currency: 'EUR' };
const savings = {
  name: 'Savings',
  bank: 'N26',
  country: 'DE',
  currency: 'EUR',
  kind: 'bank_account',
};

const setup = async () => {
  const app = mk();
  const goal = await (await authed(app, 'POST', '/goals', car)).json();
  const account = await (await authed(app, 'POST', '/accounts', savings)).json();
  return { app, goal, account };
};

describe('linking an account to a goal', () => {
  it('links and releases', async () => {
    const { app, goal, account } = await setup();
    const linked = await (
      await authed(app, 'PATCH', `/accounts/${account.id}`, { goalId: goal.id })
    ).json();
    expect(linked.goalId).toBe(goal.id);

    const released = await (
      await authed(app, 'PATCH', `/accounts/${account.id}`, { goalId: null })
    ).json();
    expect(released.goalId).toBeNull();
  });

  it('refuses a goal that belongs to somebody else', async () => {
    const { app, account } = await setup();
    const res = await authed(app, 'PATCH', `/accounts/${account.id}`, {
      goalId: '00000000-0000-0000-0000-000000000000',
    });
    expect(res.status).toBe(404);
  });

  it('refuses an account another goal already holds', async () => {
    const { app, goal, account } = await setup();
    await authed(app, 'PATCH', `/accounts/${account.id}`, { goalId: goal.id });
    const other = await (
      await authed(app, 'POST', '/goals', { name: 'Bike', targetAmount: '500', currency: 'EUR' })
    ).json();

    const res = await authed(app, 'PATCH', `/accounts/${account.id}`, { goalId: other.id });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('account_already_linked');
  });

  it('refuses an archived goal', async () => {
    const { app, goal, account } = await setup();
    await authed(app, 'PATCH', `/goals/${goal.id}`, { archivedAt: '2026-09-21T10:00:00.000Z' });
    const res = await authed(app, 'PATCH', `/accounts/${account.id}`, { goalId: goal.id });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('goal_archived');
  });
});
