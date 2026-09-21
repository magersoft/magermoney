import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { testDeps } from './helpers/deps.js';
import { authed, OTHER, SECRET } from './helpers/http.js';

const mk = () => createApp(testDeps({ jwtSecret: SECRET }));
const car = { name: 'Car', targetAmount: '10000', currency: 'EUR' };

describe('goals', () => {
  it('creates a goal and lists it', async () => {
    const app = mk();
    const created = await authed(app, 'POST', '/goals', car);
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      name: 'Car',
      targetAmount: '10000',
      currency: 'EUR',
      icon: null,
      targetDate: null,
      achievedAt: null,
      archivedAt: null,
    });

    expect(await (await authed(app, 'GET', '/goals')).json()).toHaveLength(1);
  });

  it('refuses a target that is not positive', async () => {
    const app = mk();
    expect((await authed(app, 'POST', '/goals', { ...car, targetAmount: '0' })).status).toBe(400);
    expect((await authed(app, 'POST', '/goals', { ...car, targetAmount: '-1' })).status).toBe(400);
  });

  it('refuses a currency the catalogue does not know', async () => {
    const res = await authed(mk(), 'POST', '/goals', { ...car, currency: 'ZZZ' });
    expect(res.status).toBe(400);
  });

  it('does not serve another user their neighbour goals', async () => {
    const app = mk();
    await authed(app, 'POST', '/goals', car);
    expect(await (await authed(app, 'GET', '/goals', undefined, OTHER)).json()).toEqual([]);
  });

  it('404s an unknown goal', async () => {
    const res = await authed(mk(), 'PATCH', '/goals/00000000-0000-0000-0000-000000000000', {
      name: 'Other',
    });
    expect(res.status).toBe(404);
  });
});
