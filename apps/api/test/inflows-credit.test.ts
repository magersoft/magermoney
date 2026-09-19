import { describe, expect, it } from 'vitest';
import { FixedClock } from '@magermoney/domain';
import { createApp } from '../src/app.js';
import { testDeps } from './helpers/deps.js';
import { authed, OTHER, SECRET } from './helpers/http.js';

const NOW = new Date('2026-09-11T12:00:00.000Z');
const base = { bank: 'Bank', country: 'RU', kind: 'bank_account', isSpending: true };

async function setup() {
  const app = createApp(testDeps({ jwtSecret: SECRET, clock: new FixedClock(NOW) }));
  const mkAccount = async (name: string, currency: string, amount: string) =>
    (
      await authed(app, 'POST', '/accounts', {
        ...base,
        name,
        currency,
        openingBalance: { amount, recordedAt: '2026-09-01T00:00:00.000Z' },
      })
    ).json();
  const usd = await mkAccount('USD acc', 'USD', '1000');
  const eur = await mkAccount('EUR acc', 'EUR', '100');
  const salary = await (
    await authed(app, 'POST', '/income-sources', {
      name: 'Salary',
      grossAmount: '5000',
      currency: 'USD',
      activeFrom: '2026-01-01',
    })
  ).json();
  return { app, usd, eur, salary };
}
type App = ReturnType<typeof createApp>;
const balances = async (app: App) =>
  Object.fromEntries(
    (
      (await (await authed(app, 'GET', '/accounts')).json()) as { id: string; balance: string }[]
    ).map((a) => [a.id, a.balance]),
  );
const journal = async (app: App, accountId: string) =>
  (await (await authed(app, 'GET', `/accounts/${accountId}/balances`)).json()) as {
    id: string;
    origin: string;
    inflowId: string | null;
    amount: string;
    recordedAt: string;
  }[];
const post = (app: App, body: object, uid?: string) => authed(app, 'POST', '/inflows', body, uid);

describe('credited inflows', () => {
  it('same currency: the account grows by the amount through one inflow entry dated now', async () => {
    const { app, usd, salary } = await setup();
    const res = await post(app, { incomeSourceId: salary.id, amount: '500', accountId: usd.id });
    expect(res.status).toBe(201);
    const dto = await res.json();
    expect(dto).toMatchObject({ accountId: usd.id, creditedAmount: '500', realisedRate: null });
    expect((await balances(app))[usd.id]).toBe('1500');
    const [entry] = await journal(app, usd.id);
    expect(entry).toMatchObject({
      origin: 'inflow',
      inflowId: dto.id,
      amount: '1500',
      recordedAt: NOW.toISOString(),
    });
  });

  it('cross currency: both amounts are declared and the realised rate is derived', async () => {
    const { app, eur, salary } = await setup();
    const missing = await post(app, {
      incomeSourceId: salary.id,
      amount: '100',
      accountId: eur.id,
    });
    expect(missing.status).toBe(400);
    expect((await missing.json()).code).toBe('credited_amount_required');
    const dto = await (
      await post(app, {
        incomeSourceId: salary.id,
        amount: '100',
        accountId: eur.id,
        creditedAmount: '86.14',
      })
    ).json();
    expect(dto).toMatchObject({ creditedAmount: '86.14', realisedRate: '0.8614', currency: 'USD' });
    expect((await balances(app))[eur.id]).toBe('186.14');
    const [listed] = await (await authed(app, 'GET', '/inflows')).json();
    expect(listed.realisedRate).toBe('0.8614');
  });

  it('refuses a credited amount that contradicts the amount, or one without an account', async () => {
    const { app, usd, salary } = await setup();
    const mismatch = await post(app, {
      incomeSourceId: salary.id,
      amount: '500',
      accountId: usd.id,
      creditedAmount: '499',
    });
    expect(mismatch.status).toBe(400);
    expect((await mismatch.json()).code).toBe('credited_mismatch');
    // On create the contract refuses this shape before the use case sees it…
    const orphan = await post(app, {
      incomeSourceId: salary.id,
      amount: '500',
      creditedAmount: '500',
    });
    expect(orphan.status).toBe(400);
    expect((await orphan.json()).code).toBe('VALIDATION');
    expect((await balances(app))[usd.id]).toBe('1000');
    expect(await (await authed(app, 'GET', '/inflows')).json()).toEqual([]);
    // …while a patch can only be judged against the stored row, so the use case answers.
    const bare = await (await post(app, { incomeSourceId: salary.id, amount: '500' })).json();
    const late = await authed(app, 'PATCH', `/inflows/${bare.id}`, { creditedAmount: '500' });
    expect(late.status).toBe(400);
    expect((await late.json()).code).toBe('credited_without_account');
    expect((await balances(app))[usd.id]).toBe('1000');
  });

  it('dates a past credit at the end of its day and refuses one behind a newer balance', async () => {
    const { app, usd, salary } = await setup();
    const past = await post(app, {
      incomeSourceId: salary.id,
      amount: '10',
      accountId: usd.id,
      receivedOn: '2026-09-05',
    });
    expect(past.status).toBe(201);
    expect((await journal(app, usd.id))[0]!.recordedAt).toBe('2026-09-05T23:59:59.999Z');
    const behind = await post(app, {
      incomeSourceId: salary.id,
      amount: '10',
      accountId: usd.id,
      receivedOn: '2026-09-04',
    });
    expect(behind.status).toBe(400);
    expect((await behind.json()).code).toBe('credit_not_latest');
    expect((await balances(app))[usd.id]).toBe('1010');
  });

  it('answers 404 for an account that is not the caller’s', async () => {
    const { app, salary } = await setup();
    const res = await post(app, {
      incomeSourceId: salary.id,
      amount: '1',
      accountId: '99999999-9999-4999-8999-999999999999',
    });
    expect(res.status).toBe(404);
    expect((await post(app, { incomeSourceId: salary.id, amount: '1' }, OTHER)).status).toBe(404);
  });

  it('re-applies the credit when the amount changes while the entry is the latest', async () => {
    const { app, usd, salary } = await setup();
    const dto = await (
      await post(app, { incomeSourceId: salary.id, amount: '500', accountId: usd.id })
    ).json();
    const edited = await authed(app, 'PATCH', `/inflows/${dto.id}`, { amount: '600' });
    expect(edited.status).toBe(200);
    expect(await edited.json()).toMatchObject({
      amount: '600',
      creditedAmount: '600',
      accountId: usd.id,
    });
    expect((await balances(app))[usd.id]).toBe('1600');
    const entries = await journal(app, usd.id);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ origin: 'inflow', inflowId: dto.id, amount: '1600' });
  });

  it('cross currency: a new amount needs a new credited amount; a note-only edit keeps the old one', async () => {
    const { app, eur, salary } = await setup();
    const dto = await (
      await post(app, {
        incomeSourceId: salary.id,
        amount: '100',
        accountId: eur.id,
        creditedAmount: '86.14',
      })
    ).json();
    const noted = await (
      await authed(app, 'PATCH', `/inflows/${dto.id}`, { note: 'bonus' })
    ).json();
    expect(noted).toMatchObject({ note: 'bonus', creditedAmount: '86.14', realisedRate: '0.8614' });
    expect((await balances(app))[eur.id]).toBe('186.14');
    const missing = await authed(app, 'PATCH', `/inflows/${dto.id}`, { amount: '200' });
    expect(missing.status).toBe(400);
    expect((await missing.json()).code).toBe('credited_amount_required');
    expect((await balances(app))[eur.id]).toBe('186.14');
    const both = await (
      await authed(app, 'PATCH', `/inflows/${dto.id}`, { amount: '200', creditedAmount: '170' })
    ).json();
    expect(both).toMatchObject({ creditedAmount: '170', realisedRate: '0.85' });
    expect((await balances(app))[eur.id]).toBe('270');
  });

  it('adds a credit to an inflow, moves it to another account and removes it', async () => {
    const { app, usd, eur, salary } = await setup();
    const dto = await (await post(app, { incomeSourceId: salary.id, amount: '100' })).json();
    const added = await (
      await authed(app, 'PATCH', `/inflows/${dto.id}`, { accountId: usd.id })
    ).json();
    expect(added).toMatchObject({ accountId: usd.id, creditedAmount: '100' });
    expect((await balances(app))[usd.id]).toBe('1100');
    const moved = await (
      await authed(app, 'PATCH', `/inflows/${dto.id}`, { accountId: eur.id, creditedAmount: '86' })
    ).json();
    expect(moved).toMatchObject({ accountId: eur.id, creditedAmount: '86' });
    let b = await balances(app);
    expect(b[usd.id]).toBe('1000');
    expect(b[eur.id]).toBe('186');
    const removed = await (
      await authed(app, 'PATCH', `/inflows/${dto.id}`, { accountId: null })
    ).json();
    expect(removed).toMatchObject({ accountId: null, creditedAmount: null, realisedRate: null });
    b = await balances(app);
    expect(b[eur.id]).toBe('100');
    expect(await journal(app, eur.id)).toHaveLength(1);
  });

  it('freezes once a newer balance exists, and pins the account', async () => {
    const { app, usd, salary } = await setup();
    const dto = await (
      await post(app, { incomeSourceId: salary.id, amount: '500', accountId: usd.id })
    ).json();
    await authed(app, 'POST', `/accounts/${usd.id}/balances`, { amount: '1400' });
    const stale = await authed(app, 'PATCH', `/inflows/${dto.id}`, { amount: '600' });
    expect(stale.status).toBe(409);
    expect((await stale.json()).code).toBe('inflow_not_latest');
    const del = await authed(app, 'DELETE', `/inflows/${dto.id}`);
    expect(del.status).toBe(409);
    expect((await del.json()).code).toBe('inflow_not_latest');
    const account = await authed(app, 'DELETE', `/accounts/${usd.id}`);
    expect(account.status).toBe(409);
    expect((await account.json()).code).toBe('account_has_inflows');
    expect((await balances(app))[usd.id]).toBe('1400');
  });

  it('deleting a credited inflow while it is the latest gives the balance back', async () => {
    const { app, usd, salary } = await setup();
    const dto = await (
      await post(app, { incomeSourceId: salary.id, amount: '500', accountId: usd.id })
    ).json();
    expect((await authed(app, 'DELETE', `/inflows/${dto.id}`)).status).toBe(204);
    expect((await balances(app))[usd.id]).toBe('1000');
    expect(await journal(app, usd.id)).toHaveLength(1);
    expect((await authed(app, 'DELETE', `/accounts/${usd.id}`)).status).toBe(204);
  });

  it('the journal refuses to edit or delete an inflow entry directly', async () => {
    const { app, usd, salary } = await setup();
    await post(app, { incomeSourceId: salary.id, amount: '500', accountId: usd.id });
    const [entry] = await journal(app, usd.id);
    const edit = await authed(app, 'PATCH', `/balances/${entry!.id}`, { amount: '1' });
    expect(edit.status).toBe(409);
    expect((await edit.json()).code).toBe('entry_not_manual');
    const del = await authed(app, 'DELETE', `/balances/${entry!.id}`);
    expect(del.status).toBe(409);
    expect((await del.json()).code).toBe('entry_not_manual');
  });

  it('a transfer still works on an account whose latest entry is an inflow', async () => {
    const { app, usd, salary } = await setup();
    await post(app, { incomeSourceId: salary.id, amount: '500', accountId: usd.id });
    const other = await (
      await authed(app, 'POST', '/accounts', { ...base, name: 'USD 2', currency: 'USD' })
    ).json();
    const t = await authed(app, 'POST', '/transfers', {
      fromAccountId: usd.id,
      toAccountId: other.id,
      amountSent: '200',
    });
    expect(t.status).toBe(201);
    expect((await balances(app))[usd.id]).toBe('1300');
  });
});
