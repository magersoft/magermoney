import { describe, expect, it } from 'vitest';
import { FixedClock } from '@magermoney/domain';
import { createApp } from '../src/app.js';
import { testDeps } from './helpers/deps.js';
import { authed, OTHER, SECRET } from './helpers/http.js';

const NOW = new Date('2026-09-17T12:00:00.000Z');
const mk = () => createApp(testDeps({ jwtSecret: SECRET, clock: new FixedClock(NOW) }));
const rent = {
  categoryName: 'Housing',
  name: 'Rent',
  amount: '900.00',
  currency: 'EUR',
  period: 'monthly',
  billingDay: 5,
  isEssential: true,
  activeFrom: '2026-01-01',
};

describe('expense categories', () => {
  it('creates, lists in sort order, renames and hides them from other users', async () => {
    const app = mk();
    const a = await authed(app, 'POST', '/expense-categories', {
      name: 'Subscriptions',
      sortOrder: 2,
    });
    expect(a.status).toBe(201);
    const b = await authed(app, 'POST', '/expense-categories', {
      name: 'Housing',
      icon: 'lucide:home',
      sortOrder: 1,
    });
    expect(await b.json()).toMatchObject({ name: 'Housing', icon: 'lucide:home', sortOrder: 1 });
    const list = await (await authed(app, 'GET', '/expense-categories')).json();
    expect(list.map((c: { name: string }) => c.name)).toEqual(['Housing', 'Subscriptions']);
    expect(
      await (await authed(app, 'GET', '/expense-categories', undefined, OTHER)).json(),
    ).toEqual([]);
    const id = (await a.json()).id;
    const renamed = await authed(app, 'PATCH', `/expense-categories/${id}`, { name: 'Subs' });
    expect(renamed.status).toBe(200);
    expect((await renamed.json()).name).toBe('Subs');
    expect(
      (await authed(app, 'PATCH', `/expense-categories/${id}`, { name: 'X' }, OTHER)).status,
    ).toBe(404);
  });

  it('refuses a duplicate name case-insensitively on create and on rename', async () => {
    const app = mk();
    await authed(app, 'POST', '/expense-categories', { name: 'Housing' });
    const dup = await authed(app, 'POST', '/expense-categories', { name: ' housing ' });
    expect(dup.status).toBe(409);
    expect((await dup.json()).code).toBe('category_name_taken');
    const other = await (await authed(app, 'POST', '/expense-categories', { name: 'Car' })).json();
    const rename = await authed(app, 'PATCH', `/expense-categories/${other.id}`, {
      name: 'HOUSING',
    });
    expect(rename.status).toBe(409);
    expect((await rename.json()).code).toBe('category_name_taken');
    // Renaming a category to its own name in another case is not a conflict.
    expect(
      (await authed(app, 'PATCH', `/expense-categories/${other.id}`, { name: 'CAR' })).status,
    ).toBe(200);
  });

  it('deletes an empty category and refuses one that still has expenses', async () => {
    const app = mk();
    const empty = await (
      await authed(app, 'POST', '/expense-categories', { name: 'Empty' })
    ).json();
    expect((await authed(app, 'DELETE', `/expense-categories/${empty.id}`)).status).toBe(204);
    expect((await authed(app, 'DELETE', `/expense-categories/${empty.id}`)).status).toBe(404);
    const expense = await (await authed(app, 'POST', '/expenses', rent)).json();
    const res = await authed(app, 'DELETE', `/expense-categories/${expense.categoryId}`);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('category_has_expenses');
  });
});

describe('expenses', () => {
  it('creates the category on the fly, then reuses it case-insensitively', async () => {
    const app = mk();
    const first = await authed(app, 'POST', '/expenses', rent);
    expect(first.status).toBe(201);
    const dto = await first.json();
    expect(dto).toMatchObject({
      name: 'Rent',
      amount: '900.00',
      currency: 'EUR',
      period: 'monthly',
      billingDay: 5,
      billingMonth: null,
      isEssential: true,
      activeFrom: '2026-01-01',
      activeTo: null,
    });
    const second = await (
      await authed(app, 'POST', '/expenses', {
        ...rent,
        name: 'Utilities',
        categoryName: 'HOUSING',
      })
    ).json();
    expect(second.categoryId).toBe(dto.categoryId);
    expect(await (await authed(app, 'GET', '/expense-categories')).json()).toHaveLength(1);
  });

  it('accepts a categoryId, defaults the optional fields and dates the start today', async () => {
    const app = mk();
    const cat = await (
      await authed(app, 'POST', '/expense-categories', { name: 'Telecom' })
    ).json();
    const res = await authed(app, 'POST', '/expenses', {
      categoryId: cat.id,
      name: 'Internet',
      amount: '29.90',
      currency: 'EUR',
      period: 'monthly',
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      categoryId: cat.id,
      billingDay: null,
      billingMonth: null,
      isEssential: false,
      activeFrom: '2026-09-17',
      activeTo: null,
    });
  });

  it('rejects a missing, an ambiguous and an unknown category', async () => {
    const app = mk();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { categoryName: _n, ...bare } = rent;
    const missing = await authed(app, 'POST', '/expenses', bare);
    expect(missing.status).toBe(400);
    const cat = await (
      await authed(app, 'POST', '/expense-categories', { name: 'Housing' })
    ).json();
    const both = await authed(app, 'POST', '/expenses', { ...rent, categoryId: cat.id });
    expect(both.status).toBe(400);
    const unknown = await authed(app, 'POST', '/expenses', {
      ...bare,
      categoryId: '33333333-3333-4333-8333-333333333333',
    });
    expect(unknown.status).toBe(404);
    // Another user's category is as good as unknown.
    const foreign = await authed(app, 'POST', '/expenses', { ...bare, categoryId: cat.id }, OTHER);
    expect(foreign.status).toBe(404);
  });

  it('rejects an unknown currency, a negative amount and an inverted active period', async () => {
    const app = mk();
    const cur = await authed(app, 'POST', '/expenses', { ...rent, currency: 'XYZ' });
    expect(cur.status).toBe(400);
    expect((await cur.json()).code).toBe('UNKNOWN_CURRENCY');
    const neg = await authed(app, 'POST', '/expenses', { ...rent, amount: '-1' });
    expect(neg.status).toBe(400);
    // The contract refuses an inverted period in one payload; `active_period_invalid` is the use case's
    // answer when only the merged row is inverted (see the patch test below).
    const period = await authed(app, 'POST', '/expenses', { ...rent, activeTo: '2025-12-31' });
    expect(period.status).toBe(400);
    expect((await period.json()).code).toBe('VALIDATION');
    // Nothing was created along the way, not even the category.
    expect(await (await authed(app, 'GET', '/expenses')).json()).toEqual([]);
  });

  it('allows billingMonth only on a yearly expense, on create and after a patch', async () => {
    const app = mk();
    // Both fields in one payload: the contract answers before the use case.
    const bad = await authed(app, 'POST', '/expenses', { ...rent, billingMonth: 3 });
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe('VALIDATION');
    const yearly = await authed(app, 'POST', '/expenses', {
      ...rent,
      name: 'IDE licence',
      period: 'yearly',
      billingDay: 14,
      billingMonth: 3,
    });
    expect(yearly.status).toBe(201);
    const id = (await yearly.json()).id;
    const flip = await authed(app, 'PATCH', `/expenses/${id}`, { period: 'monthly' });
    expect(flip.status).toBe(400);
    expect((await flip.json()).code).toBe('billing_month_requires_yearly');
    const ok = await authed(app, 'PATCH', `/expenses/${id}`, {
      period: 'monthly',
      billingMonth: null,
    });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({
      period: 'monthly',
      billingMonth: null,
      billingDay: 14,
    });
  });

  it('patches fields, moves to another category by name, ends through activeTo and stays listed', async () => {
    const app = mk();
    const created = await (await authed(app, 'POST', '/expenses', rent)).json();
    const moved = await authed(app, 'PATCH', `/expenses/${created.id}`, {
      categoryName: 'Home',
      amount: '1600',
      isEssential: false,
    });
    expect(moved.status).toBe(200);
    const dto = await moved.json();
    expect(dto).toMatchObject({ amount: '1600', isEssential: false, name: 'Rent' });
    expect(dto.categoryId).not.toBe(created.categoryId);
    const ended = await authed(app, 'PATCH', `/expenses/${created.id}`, { activeTo: '2026-08-31' });
    expect((await ended.json()).activeTo).toBe('2026-08-31');
    const inverted = await authed(app, 'PATCH', `/expenses/${created.id}`, {
      activeFrom: '2026-09-01',
    });
    expect(inverted.status).toBe(400);
    expect((await inverted.json()).code).toBe('active_period_invalid');
    const list = await (await authed(app, 'GET', '/expenses')).json();
    expect(list).toHaveLength(1);
    expect(list[0].activeTo).toBe('2026-08-31');
    expect(await (await authed(app, 'GET', '/expenses', undefined, OTHER)).json()).toEqual([]);
  });

  it('deletes unconditionally and answers 404 for a missing or foreign expense', async () => {
    const app = mk();
    const created = await (await authed(app, 'POST', '/expenses', rent)).json();
    expect(
      (await authed(app, 'PATCH', `/expenses/${created.id}`, { name: 'X' }, OTHER)).status,
    ).toBe(404);
    expect((await authed(app, 'DELETE', `/expenses/${created.id}`, undefined, OTHER)).status).toBe(
      404,
    );
    expect((await authed(app, 'DELETE', `/expenses/${created.id}`)).status).toBe(204);
    expect((await authed(app, 'DELETE', `/expenses/${created.id}`)).status).toBe(404);
  });

  it('requires a signed-in user', async () => {
    const app = mk();
    expect((await app.request('/expenses')).status).toBe(401);
    expect((await app.request('/expense-categories')).status).toBe(401);
  });
});
