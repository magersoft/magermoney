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
  kind: 'cash',
  isSpending: false,
};

async function setup() {
  const app = createApp(testDeps({ jwtSecret: SECRET, clock: new FixedClock(NOW) }));
  const acc = await (
    await authed(app, 'POST', '/accounts', {
      ...alfa,
      openingBalance: { amount: '100', recordedAt: '2026-09-01T00:00:00.000Z' },
    })
  ).json();
  return { app, acc };
}

describe('balances', () => {
  it('records a balance dated now, updates the account balance, and lists newest first', async () => {
    const { app, acc } = await setup();
    const res = await authed(app, 'POST', `/accounts/${acc.id}/balances`, {
      amount: '120.5',
      note: 'salary',
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      amount: '120.5',
      recordedAt: NOW.toISOString(),
      origin: 'manual',
      transferId: null,
    });
    const [a] = await (await authed(app, 'GET', '/accounts')).json();
    expect(a.balance).toBe('120.5');
    const list = await (await authed(app, 'GET', `/accounts/${acc.id}/balances?limit=1`)).json();
    expect(list).toHaveLength(1);
    expect(list[0].amount).toBe('120.5');
    const older = await (
      await authed(
        app,
        'GET',
        `/accounts/${acc.id}/balances?limit=1&before=${encodeURIComponent(`${list[0].recordedAt}|${list[0].id}`)}`,
      )
    ).json();
    expect(older[0].amount).toBe('100');
  });
  it('a backdated entry keeps the current balance', async () => {
    const { app, acc } = await setup();
    await authed(app, 'POST', `/accounts/${acc.id}/balances`, {
      amount: '50',
      recordedAt: '2026-08-01T00:00:00.000Z',
    });
    const [a] = await (await authed(app, 'GET', '/accounts')).json();
    expect(a.balance).toBe('100');
  });
  it('rejects the future and other people', async () => {
    const { app, acc } = await setup();
    expect(
      (
        await (
          await authed(app, 'POST', `/accounts/${acc.id}/balances`, {
            amount: '1',
            recordedAt: '2027-01-01T00:00:00.000Z',
          })
        ).json()
      ).code,
    ).toBe('recorded_in_future');
    expect(
      (await authed(app, 'POST', `/accounts/${acc.id}/balances`, { amount: '1' }, OTHER)).status,
    ).toBe(404);
    expect(
      (await authed(app, 'GET', `/accounts/${acc.id}/balances`, undefined, OTHER)).status,
    ).toBe(404);
  });
  it('edits and deletes only the latest manual entry', async () => {
    const { app, acc } = await setup();
    const [first] = await (await authed(app, 'GET', `/accounts/${acc.id}/balances`)).json();
    const edited = await authed(app, 'PATCH', `/balances/${first.id}`, { amount: '101' });
    expect(edited.status).toBe(200);
    const second = await (
      await authed(app, 'POST', `/accounts/${acc.id}/balances`, { amount: '200' })
    ).json();
    const stale = await authed(app, 'PATCH', `/balances/${first.id}`, { amount: '102' });
    expect(stale.status).toBe(409);
    expect((await stale.json()).code).toBe('entry_not_latest');
    expect((await authed(app, 'DELETE', `/balances/${first.id}`)).status).toBe(409);
    expect((await authed(app, 'DELETE', `/balances/${second.id}`)).status).toBe(204);
    const [a] = await (await authed(app, 'GET', '/accounts')).json();
    expect(a.balance).toBe('101');
    expect((await authed(app, 'DELETE', `/balances/${second.id}`)).status).toBe(404);
  });
  it('refuses to edit the latest entry to a date before the previous one', async () => {
    const { app, acc } = await setup();
    const second = await (
      await authed(app, 'POST', `/accounts/${acc.id}/balances`, { amount: '200' })
    ).json();
    const tooEarly = await authed(app, 'PATCH', `/balances/${second.id}`, {
      recordedAt: '2026-08-15T00:00:00.000Z',
    });
    expect(tooEarly.status).toBe(400);
    expect((await tooEarly.json()).code).toBe('recorded_before_previous');
    const ok = await authed(app, 'PATCH', `/balances/${second.id}`, {
      recordedAt: '2026-09-05T00:00:00.000Z',
    });
    expect(ok.status).toBe(200);
  });
});
