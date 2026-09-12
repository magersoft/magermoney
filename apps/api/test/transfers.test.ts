import { describe, expect, it } from 'vitest';
import { FixedClock } from '@magermoney/domain';
import { createApp } from '../src/app.js';
import { testDeps } from './helpers/deps.js';
import { authed, OTHER, SECRET } from './helpers/http.js';

const NOW = new Date('2026-09-11T12:00:00.000Z');
const base = { bank: 'Kapital', country: 'UZ', kind: 'bank_account', isSpending: false };

async function setup() {
  const app = createApp(testDeps({ jwtSecret: SECRET, clock: new FixedClock(NOW) }));
  const mk = async (name: string, currency: string, amount: string, extra: object = {}) =>
    (
      await authed(app, 'POST', '/accounts', {
        ...base,
        name,
        currency,
        ...extra,
        openingBalance: { amount, recordedAt: '2026-09-01T00:00:00.000Z' },
      })
    ).json();
  const usd = await mk('USD acc', 'USD', '1000');
  const eur = await mk('EUR acc', 'EUR', '100');
  const usd2 = await mk('USD 2', 'USD', '0');
  return { app, usd, eur, usd2 };
}
const balances = async (app: ReturnType<typeof createApp>) =>
  Object.fromEntries(
    (
      (await (await authed(app, 'GET', '/accounts')).json()) as { id: string; balance: string }[]
    ).map((a) => [a.id, a.balance]),
  );

describe('transfers', () => {
  it('same currency: received defaults to sent, fee is derived, both balances move', async () => {
    const { app, usd, usd2 } = await setup();
    const res = await authed(app, 'POST', '/transfers', {
      fromAccountId: usd.id,
      toAccountId: usd2.id,
      amountSent: '100',
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      amountSent: '100',
      amountReceived: '100',
      fee: '0',
      realisedRate: null,
      occurredAt: NOW.toISOString(),
    });
    const b = await balances(app);
    expect(b[usd.id]).toBe('900');
    expect(b[usd2.id]).toBe('100');
  });
  it('cross currency requires received and derives the rate', async () => {
    const { app, usd, eur } = await setup();
    const missing = await authed(app, 'POST', '/transfers', {
      fromAccountId: usd.id,
      toAccountId: eur.id,
      amountSent: '100',
    });
    expect(missing.status).toBe(400);
    expect((await missing.json()).code).toBe('amount_received_required');
    const ok = await (
      await authed(app, 'POST', '/transfers', {
        fromAccountId: usd.id,
        toAccountId: eur.id,
        amountSent: '100',
        amountReceived: '86.14',
      })
    ).json();
    expect(ok).toMatchObject({ realisedRate: '0.8614', fee: null });
    const b = await balances(app);
    expect(b[eur.id]).toBe('186.14');
  });
  it('refuses same account, overdraft, foreign accounts and the future', async () => {
    const { app, usd, usd2 } = await setup();
    expect(
      (
        await (
          await authed(app, 'POST', '/transfers', {
            fromAccountId: usd.id,
            toAccountId: usd.id,
            amountSent: '1',
          })
        ).json()
      ).code,
    ).toBe('TRANSFER_INVALID');
    expect(
      (
        await (
          await authed(app, 'POST', '/transfers', {
            fromAccountId: usd2.id,
            toAccountId: usd.id,
            amountSent: '1',
          })
        ).json()
      ).code,
    ).toBe('INSUFFICIENT_FUNDS');
    expect(
      (
        await authed(
          app,
          'POST',
          '/transfers',
          { fromAccountId: usd.id, toAccountId: usd2.id, amountSent: '1' },
          OTHER,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await (
          await authed(app, 'POST', '/transfers', {
            fromAccountId: usd.id,
            toAccountId: usd2.id,
            amountSent: '1',
            occurredAt: '2027-01-01T00:00:00.000Z',
          })
        ).json()
      ).code,
    ).toBe('recorded_in_future');
  });
  it('a credit card may overdraw', async () => {
    const { app, usd } = await setup();
    const credit = await (
      await authed(app, 'POST', '/accounts', {
        ...base,
        name: 'Credit',
        currency: 'USD',
        kind: 'card',
        cardType: 'credit',
      })
    ).json();
    const res = await authed(app, 'POST', '/transfers', {
      fromAccountId: credit.id,
      toAccountId: usd.id,
      amountSent: '10',
    });
    expect(res.status).toBe(201);
    expect((await balances(app))[credit.id]).toBe('-10');
  });
  it('edits and deletes a transfer only while both entries are latest', async () => {
    const { app, usd, usd2 } = await setup();
    const t = await (
      await authed(app, 'POST', '/transfers', {
        fromAccountId: usd.id,
        toAccountId: usd2.id,
        amountSent: '100',
      })
    ).json();
    const edited = await authed(app, 'PATCH', `/transfers/${t.id}`, {
      amountSent: '150',
      amountReceived: '149',
    });
    expect(edited.status).toBe(200);
    let b = await balances(app);
    expect(b[usd.id]).toBe('850');
    expect(b[usd2.id]).toBe('149');
    await authed(app, 'POST', `/accounts/${usd2.id}/balances`, { amount: '160' });
    const stale = await authed(app, 'PATCH', `/transfers/${t.id}`, { amountSent: '1' });
    expect(stale.status).toBe(409);
    expect((await stale.json()).code).toBe('transfer_not_latest');
    expect((await authed(app, 'DELETE', `/transfers/${t.id}`)).status).toBe(409);
    expect((await authed(app, 'DELETE', `/accounts/${usd2.id}`)).status).toBe(409);
    const t2 = await (
      await authed(app, 'POST', '/transfers', {
        fromAccountId: usd.id,
        toAccountId: usd2.id,
        amountSent: '50',
      })
    ).json();
    expect((await authed(app, 'DELETE', `/transfers/${t2.id}`)).status).toBe(204);
    b = await balances(app);
    expect(b[usd.id]).toBe('850');
    expect(b[usd2.id]).toBe('160');
  });
  it('lists newest first, optionally by account', async () => {
    const { app, usd, eur, usd2 } = await setup();
    await authed(app, 'POST', '/transfers', {
      fromAccountId: usd.id,
      toAccountId: usd2.id,
      amountSent: '1',
      occurredAt: '2026-09-02T00:00:00.000Z',
    });
    await authed(app, 'POST', '/transfers', {
      fromAccountId: usd.id,
      toAccountId: eur.id,
      amountSent: '2',
      amountReceived: '1.7',
      occurredAt: '2026-09-03T00:00:00.000Z',
    });
    const all = await (await authed(app, 'GET', '/transfers')).json();
    expect(all.map((t: { amountSent: string }) => t.amountSent)).toEqual(['2', '1']);
    const eurOnly = await (await authed(app, 'GET', `/transfers?accountId=${eur.id}`)).json();
    expect(eurOnly).toHaveLength(1);
    expect(await (await authed(app, 'GET', '/transfers', undefined, OTHER)).json()).toEqual([]);
  });
  it('refuses to touch a transfer that is not the caller’s or does not exist', async () => {
    const { app, usd, usd2 } = await setup();
    const t = await (
      await authed(app, 'POST', '/transfers', {
        fromAccountId: usd.id,
        toAccountId: usd2.id,
        amountSent: '10',
      })
    ).json();
    expect(
      (await authed(app, 'PATCH', `/transfers/${t.id}`, { amountSent: '5' }, OTHER)).status,
    ).toBe(404);
    expect((await authed(app, 'DELETE', `/transfers/${t.id}`, undefined, OTHER)).status).toBe(404);
    const randomId = '99999999-9999-4999-8999-999999999999';
    expect((await authed(app, 'PATCH', `/transfers/${randomId}`, { amountSent: '5' })).status).toBe(
      404,
    );
    expect((await authed(app, 'DELETE', `/transfers/${randomId}`)).status).toBe(404);
  });
  it('refuses to change the accounts of a transfer', async () => {
    const { app, usd, usd2, eur } = await setup();
    const t = await (
      await authed(app, 'POST', '/transfers', {
        fromAccountId: usd.id,
        toAccountId: usd2.id,
        amountSent: '10',
      })
    ).json();
    const res = await authed(app, 'PATCH', `/transfers/${t.id}`, { toAccountId: eur.id });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('accounts_immutable');
  });
  it('refuses to date an edited transfer in the future', async () => {
    const { app, usd, usd2 } = await setup();
    const t = await (
      await authed(app, 'POST', '/transfers', {
        fromAccountId: usd.id,
        toAccountId: usd2.id,
        amountSent: '10',
      })
    ).json();
    const res = await authed(app, 'PATCH', `/transfers/${t.id}`, {
      occurredAt: '2027-01-01T00:00:00.000Z',
    });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('recorded_in_future');
  });
  it('refuses to create a transfer behind a newer balance entry', async () => {
    const { app, usd, usd2 } = await setup();
    await authed(app, 'POST', `/accounts/${usd2.id}/balances`, {
      amount: '50',
      recordedAt: NOW.toISOString(),
    });
    const res = await authed(app, 'POST', '/transfers', {
      fromAccountId: usd.id,
      toAccountId: usd2.id,
      amountSent: '10',
      occurredAt: '2026-09-10T00:00:00.000Z',
    });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('transfer_not_latest');
  });
  it('refuses to move a transfer before the entry it would then precede', async () => {
    const { app, usd, usd2 } = await setup();
    const t = await (
      await authed(app, 'POST', '/transfers', {
        fromAccountId: usd.id,
        toAccountId: usd2.id,
        amountSent: '10',
      })
    ).json();
    const res = await authed(app, 'PATCH', `/transfers/${t.id}`, {
      occurredAt: '2026-08-01T00:00:00.000Z',
    });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('transfer_not_latest');
  });
  it('keeps the fee when editing a same-currency transfer without a new received amount', async () => {
    const { app, usd, usd2 } = await setup();
    const t = await (
      await authed(app, 'POST', '/transfers', {
        fromAccountId: usd.id,
        toAccountId: usd2.id,
        amountSent: '100',
        amountReceived: '95',
      })
    ).json();
    const edited = await (
      await authed(app, 'PATCH', `/transfers/${t.id}`, { amountSent: '150' })
    ).json();
    expect(edited).toMatchObject({ amountReceived: '145', fee: '5' });
  });
});
