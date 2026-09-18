import { describe, expect, it } from 'vitest';
import { FixedClock } from '@magermoney/domain';
import { createApp } from '../src/app.js';
import { testDeps } from './helpers/deps.js';
import { authed, OTHER, SECRET } from './helpers/http.js';

const NOW = new Date('2026-09-11T12:00:00.000Z');
const RANDOM = '99999999-9999-4999-8999-999999999999';

async function setup() {
  const app = createApp(testDeps({ jwtSecret: SECRET, clock: new FixedClock(NOW) }));
  const mkSource = async (name: string, currency: string) =>
    (
      await authed(app, 'POST', '/income-sources', {
        name,
        grossAmount: '1000',
        currency,
        activeFrom: '2026-01-01',
      })
    ).json();
  const salary = await mkSource('Salary', 'USD');
  const deposit = await mkSource('Deposit', 'RUB');
  return { app, salary, deposit };
}
const post = (app: ReturnType<typeof createApp>, body: object, uid?: string) =>
  authed(app, 'POST', '/inflows', body, uid);

describe('inflows', () => {
  it('records an inflow in the currency of its source, dated today, without a credit', async () => {
    const { app, salary } = await setup();
    const res = await post(app, { incomeSourceId: salary.id, amount: '4200' });
    expect(res.status).toBe(201);
    const dto = await res.json();
    expect(dto).toMatchObject({
      incomeSourceId: salary.id,
      amount: '4200',
      currency: 'USD',
      receivedOn: '2026-09-11',
      realisedRateToUsd: null,
      accountId: null,
      creditedAmount: null,
      realisedRate: null,
      note: null,
    });
    expect(dto.userId).toBeUndefined();
  });

  it('keeps an explicit currency, date, realised rate and note', async () => {
    const { app, deposit } = await setup();
    const dto = await (
      await post(app, {
        incomeSourceId: deposit.id,
        amount: '18250.40',
        currency: 'RUB',
        receivedOn: '2026-08-31',
        realisedRateToUsd: '0.0125',
        note: 'interest',
      })
    ).json();
    expect(dto).toMatchObject({
      currency: 'RUB',
      receivedOn: '2026-08-31',
      realisedRateToUsd: '0.0125',
      note: 'interest',
    });
  });

  it('refuses the future, a non-positive amount or rate, unknown currencies and foreign sources', async () => {
    const { app, salary } = await setup();
    const future = await post(app, {
      incomeSourceId: salary.id,
      amount: '1',
      receivedOn: '2026-09-12',
    });
    expect(future.status).toBe(400);
    expect((await future.json()).code).toBe('received_in_future');
    expect((await post(app, { incomeSourceId: salary.id, amount: '0' })).status).toBe(400);
    expect((await post(app, { incomeSourceId: salary.id, amount: '-5' })).status).toBe(400);
    expect(
      (await post(app, { incomeSourceId: salary.id, amount: '1', realisedRateToUsd: '0' })).status,
    ).toBe(400);
    const unknown = await post(app, { incomeSourceId: salary.id, amount: '1', currency: 'XYZ' });
    expect((await unknown.json()).code).toBe('UNKNOWN_CURRENCY');
    expect((await post(app, { incomeSourceId: RANDOM, amount: '1' })).status).toBe(404);
    expect((await post(app, { incomeSourceId: salary.id, amount: '1' }, OTHER)).status).toBe(404);
  });

  it('lists newest first, filters by dates and source, and pages with a cursor', async () => {
    const { app, salary, deposit } = await setup();
    for (const [source, amount, receivedOn] of [
      [salary, '1', '2026-07-04'],
      [deposit, '2', '2026-07-31'],
      [salary, '3', '2026-08-04'],
      [salary, '4', '2026-09-04'],
    ] as const)
      await post(app, { incomeSourceId: source.id, amount, receivedOn });
    const amounts = async (query: string) =>
      ((await (await authed(app, 'GET', `/inflows${query}`)).json()) as { amount: string }[]).map(
        (i) => i.amount,
      );
    expect(await amounts('')).toEqual(['4', '3', '2', '1']);
    expect(await amounts('?from=2026-07-31&to=2026-08-31')).toEqual(['3', '2']);
    expect(await amounts(`?sourceId=${deposit.id}`)).toEqual(['2']);
    const firstPage = await (await authed(app, 'GET', '/inflows?limit=2')).json();
    expect(firstPage).toHaveLength(2);
    const last = firstPage[1];
    const cursor = encodeURIComponent(`${last.receivedOn}|${last.id}`);
    expect(await amounts(`?limit=2&before=${cursor}`)).toEqual(['2', '1']);
    expect(await (await authed(app, 'GET', '/inflows', undefined, OTHER)).json()).toEqual([]);
  });

  it('edits an inflow field by field and moves it to another source', async () => {
    const { app, salary, deposit } = await setup();
    const dto = await (
      await post(app, { incomeSourceId: salary.id, amount: '100', note: 'a' })
    ).json();
    const edited = await authed(app, 'PATCH', `/inflows/${dto.id}`, {
      amount: '120',
      receivedOn: '2026-09-10',
      note: null,
    });
    expect(edited.status).toBe(200);
    expect(await edited.json()).toMatchObject({
      amount: '120',
      receivedOn: '2026-09-10',
      note: null,
      currency: 'USD',
      incomeSourceId: salary.id,
    });
    const moved = await (
      await authed(app, 'PATCH', `/inflows/${dto.id}`, { incomeSourceId: deposit.id })
    ).json();
    expect(moved).toMatchObject({ incomeSourceId: deposit.id, currency: 'USD', amount: '120' });
    expect(
      (await authed(app, 'PATCH', `/inflows/${dto.id}`, { incomeSourceId: RANDOM })).status,
    ).toBe(404);
    const future = await authed(app, 'PATCH', `/inflows/${dto.id}`, { receivedOn: '2027-01-01' });
    expect((await future.json()).code).toBe('received_in_future');
  });

  it('deletes an inflow and answers 404 for strangers and unknown ids', async () => {
    const { app, salary } = await setup();
    const dto = await (await post(app, { incomeSourceId: salary.id, amount: '100' })).json();
    expect((await authed(app, 'PATCH', `/inflows/${dto.id}`, { amount: '1' }, OTHER)).status).toBe(
      404,
    );
    expect((await authed(app, 'DELETE', `/inflows/${dto.id}`, undefined, OTHER)).status).toBe(404);
    expect((await authed(app, 'DELETE', `/inflows/${dto.id}`)).status).toBe(204);
    expect((await authed(app, 'DELETE', `/inflows/${dto.id}`)).status).toBe(404);
    expect((await authed(app, 'PATCH', `/inflows/${RANDOM}`, { amount: '1' })).status).toBe(404);
  });

  it('pins its source: a source with inflows cannot be deleted or change currency', async () => {
    const { app, salary } = await setup();
    const dto = await (await post(app, { incomeSourceId: salary.id, amount: '100' })).json();
    const del = await authed(app, 'DELETE', `/income-sources/${salary.id}`);
    expect(del.status).toBe(409);
    expect((await del.json()).code).toBe('source_has_inflows');
    const cur = await authed(app, 'PATCH', `/income-sources/${salary.id}`, { currency: 'EUR' });
    expect((await cur.json()).code).toBe('source_has_inflows');
    await authed(app, 'DELETE', `/inflows/${dto.id}`);
    expect((await authed(app, 'DELETE', `/income-sources/${salary.id}`)).status).toBe(204);
  });

  it('requires a session', async () => {
    const { app } = await setup();
    expect((await app.request('/inflows')).status).toBe(401);
  });
});
