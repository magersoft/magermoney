import { describe, expect, it } from 'vitest';
import { FixedClock } from '@magermoney/domain';
import { createApp } from '../src/app.js';
import { testDeps } from './helpers/deps.js';
import { authed, OTHER, SECRET } from './helpers/http.js';

const NOW = new Date('2026-09-17T12:00:00.000Z');
const mk = () => createApp(testDeps({ jwtSecret: SECRET, clock: new FixedClock(NOW) }));
const food = { name: 'Groceries', monthlyLimit: '1000.00', currency: 'EUR' };

describe('budgets', () => {
  it('creates a budget starting today by default and lists it only to its owner', async () => {
    const app = mk();
    const res = await authed(app, 'POST', '/budgets', food);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      name: 'Groceries',
      icon: null,
      monthlyLimit: '1000.00',
      currency: 'EUR',
      activeFrom: '2026-09-17',
      activeTo: null,
    });
    expect(await (await authed(app, 'GET', '/budgets')).json()).toHaveLength(1);
    expect(await (await authed(app, 'GET', '/budgets', undefined, OTHER)).json()).toEqual([]);
  });

  it('keeps an explicit icon and active period, and lists budgets by name', async () => {
    const app = mk();
    await authed(app, 'POST', '/budgets', { ...food, name: 'Taxi' });
    const res = await authed(app, 'POST', '/budgets', {
      ...food,
      name: 'Eating out',
      icon: 'lucide:utensils',
      activeFrom: '2026-01-01',
      activeTo: '2026-12-31',
    });
    expect(await res.json()).toMatchObject({
      icon: 'lucide:utensils',
      activeFrom: '2026-01-01',
      activeTo: '2026-12-31',
    });
    const list = await (await authed(app, 'GET', '/budgets')).json();
    expect(list.map((b: { name: string }) => b.name)).toEqual(['Eating out', 'Taxi']);
  });

  it('rejects an unknown currency, a negative limit and an inverted active period', async () => {
    const app = mk();
    const cur = await authed(app, 'POST', '/budgets', { ...food, currency: 'XYZ' });
    expect(cur.status).toBe(400);
    expect((await cur.json()).code).toBe('UNKNOWN_CURRENCY');
    expect((await authed(app, 'POST', '/budgets', { ...food, monthlyLimit: '-5' })).status).toBe(
      400,
    );
    const period = await authed(app, 'POST', '/budgets', {
      ...food,
      activeFrom: '2026-09-01',
      activeTo: '2026-08-31',
    });
    expect(period.status).toBe(400);
    // One payload, so the contract answers; the merged-row case below reaches `active_period_invalid`.
    expect((await period.json()).code).toBe('VALIDATION');
    expect(await (await authed(app, 'GET', '/budgets')).json()).toEqual([]);
  });

  it('patches the limit, ends through activeTo, validates the merged period and stays listed', async () => {
    const app = mk();
    const created = await (
      await authed(app, 'POST', '/budgets', { ...food, activeFrom: '2026-01-01' })
    ).json();
    const patched = await authed(app, 'PATCH', `/budgets/${created.id}`, { monthlyLimit: '1200' });
    expect(patched.status).toBe(200);
    expect((await patched.json()).monthlyLimit).toBe('1200');
    const ended = await authed(app, 'PATCH', `/budgets/${created.id}`, { activeTo: '2026-08-31' });
    expect((await ended.json()).activeTo).toBe('2026-08-31');
    const inverted = await authed(app, 'PATCH', `/budgets/${created.id}`, {
      activeFrom: '2026-09-01',
    });
    expect(inverted.status).toBe(400);
    expect((await inverted.json()).code).toBe('active_period_invalid');
    const reopened = await authed(app, 'PATCH', `/budgets/${created.id}`, { activeTo: null });
    expect((await reopened.json()).activeTo).toBeNull();
    expect(await (await authed(app, 'GET', '/budgets')).json()).toHaveLength(1);
  });

  it('deletes unconditionally and answers 404 for a missing or foreign budget', async () => {
    const app = mk();
    const created = await (await authed(app, 'POST', '/budgets', food)).json();
    expect(
      (await authed(app, 'PATCH', `/budgets/${created.id}`, { name: 'X' }, OTHER)).status,
    ).toBe(404);
    expect((await authed(app, 'DELETE', `/budgets/${created.id}`, undefined, OTHER)).status).toBe(
      404,
    );
    expect((await authed(app, 'DELETE', `/budgets/${created.id}`)).status).toBe(204);
    expect((await authed(app, 'DELETE', `/budgets/${created.id}`)).status).toBe(404);
  });

  it('requires a signed-in user', async () => {
    expect((await mk().request('/budgets')).status).toBe(401);
  });
});
