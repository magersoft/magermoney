import { describe, expect, it } from 'vitest';
import { FixedClock } from '@magermoney/domain';
import { createApp } from '../src/app.js';
import { testDeps } from './helpers/deps.js';
import { authed, OTHER, SECRET } from './helpers/http.js';

const NOW = new Date('2026-09-11T12:00:00.000Z');
const alfa = {
  name: 'Alfa',
  bank: 'Alfa',
  country: 'RU',
  currency: 'RUB',
  kind: 'bank_account',
  isSpending: true,
};
const mk = () => createApp(testDeps({ jwtSecret: SECRET, clock: new FixedClock(NOW) }));

describe('accounts', () => {
  it('creates an account with an opening balance dated now and lists it', async () => {
    const app = mk();
    const created = await authed(app, 'POST', '/accounts', {
      ...alfa,
      openingBalance: { amount: '14577.45' },
    });
    expect(created.status).toBe(201);
    const dto = await created.json();
    expect(dto).toMatchObject({
      name: 'Alfa',
      balance: '14577.45',
      balanceRecordedAt: NOW.toISOString(),
      cardType: null,
      archivedAt: null,
    });
    const list = await (await authed(app, 'GET', '/accounts')).json();
    expect(list).toHaveLength(1);
    expect(await (await authed(app, 'GET', '/accounts', undefined, OTHER)).json()).toEqual([]);
  });
  it('rejects an unknown currency and a future opening balance', async () => {
    const app = mk();
    expect((await authed(app, 'POST', '/accounts', { ...alfa, currency: 'XYZ' })).status).toBe(400);
    const future = await authed(app, 'POST', '/accounts', {
      ...alfa,
      openingBalance: { amount: '1', recordedAt: '2027-01-01T00:00:00.000Z' },
    });
    expect(future.status).toBe(400);
    expect((await future.json()).code).toBe('recorded_in_future');
  });
  it('refuses to change the currency once there is history, allows it before', async () => {
    const app = mk();
    const fresh = await (await authed(app, 'POST', '/accounts', alfa)).json();
    expect((await authed(app, 'PATCH', `/accounts/${fresh.id}`, { currency: 'USD' })).status).toBe(
      200,
    );
    const withHistory = await (
      await authed(app, 'POST', '/accounts', { ...alfa, openingBalance: { amount: '1' } })
    ).json();
    const res = await authed(app, 'PATCH', `/accounts/${withHistory.id}`, { currency: 'USD' });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('account_has_history');
  });
  it('clears card fields when the kind stops being card', async () => {
    const app = mk();
    const card = await (
      await authed(app, 'POST', '/accounts', {
        ...alfa,
        kind: 'card',
        cardType: 'debit',
        cardLast4: '5520',
      })
    ).json();
    const changed = await (
      await authed(app, 'PATCH', `/accounts/${card.id}`, { kind: 'cash' })
    ).json();
    expect(changed).toMatchObject({ kind: 'cash', cardType: null, cardLast4: null });
  });
  it('archives, unarchives, and 404s for another user', async () => {
    const app = mk();
    const a = await (await authed(app, 'POST', '/accounts', alfa)).json();
    const archived = await (await authed(app, 'POST', `/accounts/${a.id}/archive`)).json();
    expect(archived.archivedAt).toBe(NOW.toISOString());
    const back = await (await authed(app, 'POST', `/accounts/${a.id}/unarchive`)).json();
    expect(back.archivedAt).toBeNull();
    expect((await authed(app, 'POST', `/accounts/${a.id}/archive`, undefined, OTHER)).status).toBe(
      404,
    );
  });
  it('deletes an account without transfers and reorders', async () => {
    const app = mk();
    const a = await (await authed(app, 'POST', '/accounts', alfa)).json();
    const b = await (await authed(app, 'POST', '/accounts', { ...alfa, name: 'Beta' })).json();
    expect((await authed(app, 'PATCH', '/accounts/order', { ids: [b.id, a.id] })).status).toBe(204);
    const list = await (await authed(app, 'GET', '/accounts')).json();
    expect(list.map((x: { name: string }) => x.name)).toEqual(['Beta', 'Alfa']);
    expect(
      (
        await authed(app, 'PATCH', '/accounts/order', {
          ids: [a.id, '33333333-3333-4333-8333-333333333333'],
        })
      ).status,
    ).toBe(400);
    expect((await authed(app, 'DELETE', `/accounts/${a.id}`)).status).toBe(204);
    expect((await authed(app, 'DELETE', `/accounts/${a.id}`)).status).toBe(404);
  });
});
