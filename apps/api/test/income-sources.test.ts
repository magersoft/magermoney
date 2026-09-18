import { describe, expect, it } from 'vitest';
import { FixedClock } from '@magermoney/domain';
import { createApp } from '../src/app.js';
import { memoryRepos, testDeps } from './helpers/deps.js';
import { authed, OTHER, SECRET } from './helpers/http.js';

const NOW = new Date('2026-09-11T12:00:00.000Z');
const salary = {
  name: 'Salary',
  grossAmount: '1000',
  currency: 'USD',
  taxRate: '0.15',
  commissionRate: '0.1',
  payDays: [25, 10],
  isPrimary: true,
  activeFrom: '2026-01-01',
};

function setup() {
  const repos = memoryRepos();
  const app = createApp(testDeps({ jwtSecret: SECRET, clock: new FixedClock(NOW), repos }));
  return { app, repos };
}
const create = async (app: ReturnType<typeof createApp>, body: object) =>
  authed(app, 'POST', '/income-sources', body);

describe('income sources', () => {
  it('creates a source, sorts its pay days, derives the monthly net and lists it', async () => {
    const { app } = setup();
    const res = await create(app, salary);
    expect(res.status).toBe(201);
    const dto = await res.json();
    expect(dto).toMatchObject({
      name: 'Salary',
      grossAmount: '1000',
      currency: 'USD',
      payDays: [10, 25],
      isPrimary: true,
      activeFrom: '2026-01-01',
      activeTo: null,
      defaultAccountId: null,
      netMonthly: '765',
    });
    expect(dto.userId).toBeUndefined();
    const list = await (await authed(app, 'GET', '/income-sources')).json();
    expect(list).toHaveLength(1);
    expect(await (await authed(app, 'GET', '/income-sources', undefined, OTHER)).json()).toEqual(
      [],
    );
  });

  it('keeps a single primary source and lists it first', async () => {
    const { app } = setup();
    const first = await (await create(app, { ...salary, name: 'B first' })).json();
    const second = await (await create(app, { ...salary, name: 'A second' })).json();
    let list = await (await authed(app, 'GET', '/income-sources')).json();
    expect(list.map((s: { name: string; isPrimary: boolean }) => [s.name, s.isPrimary])).toEqual([
      ['A second', true],
      ['B first', false],
    ]);
    const back = await authed(app, 'PATCH', `/income-sources/${first.id}`, { isPrimary: true });
    expect(back.status).toBe(200);
    list = await (await authed(app, 'GET', '/income-sources')).json();
    expect(
      list.filter((s: { isPrimary: boolean }) => s.isPrimary).map((s: { id: string }) => s.id),
    ).toEqual([first.id]);
    expect(second.isPrimary).toBe(true);
  });

  it('refuses an unknown currency, a foreign default account and a period that ends before it starts', async () => {
    const { app } = setup();
    const unknown = await create(app, { ...salary, currency: 'XYZ' });
    expect(unknown.status).toBe(400);
    expect((await unknown.json()).code).toBe('UNKNOWN_CURRENCY');
    const foreign = await create(app, {
      ...salary,
      defaultAccountId: '99999999-9999-4999-8999-999999999999',
    });
    expect(foreign.status).toBe(400);
    expect((await foreign.json()).code).toBe('default_account_not_found');
    expect((await create(app, { ...salary, activeTo: '2025-12-31' })).status).toBe(400);
    expect((await create(app, { ...salary, taxRate: '1' })).status).toBe(400);
    expect((await create(app, { ...salary, payDays: [32] })).status).toBe(400);
    expect((await create(app, { ...salary, grossAmount: '-1' })).status).toBe(400);
  });

  it('starts a source today when no start date is sent', async () => {
    const { app } = setup();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { activeFrom: _from, ...noStart } = salary;
    const dto = await (await create(app, noStart)).json();
    expect(dto.activeFrom).toBe('2026-09-11');
  });

  it('accepts the caller’s own account as the default account', async () => {
    const { app } = setup();
    const acc = await (
      await authed(app, 'POST', '/accounts', {
        name: 'Main',
        bank: 'Bank',
        country: 'RU',
        currency: 'USD',
        kind: 'bank_account',
        isSpending: true,
      })
    ).json();
    const dto = await (await create(app, { ...salary, defaultAccountId: acc.id })).json();
    expect(dto.defaultAccountId).toBe(acc.id);
    const cleared = await (
      await authed(app, 'PATCH', `/income-sources/${dto.id}`, { defaultAccountId: null })
    ).json();
    expect(cleared.defaultAccountId).toBeNull();
  });

  it('ends a source through activeTo and keeps the rest of the row', async () => {
    const { app } = setup();
    const dto = await (await create(app, salary)).json();
    const ended = await authed(app, 'PATCH', `/income-sources/${dto.id}`, {
      activeTo: '2026-09-30',
    });
    expect(ended.status).toBe(200);
    expect(await ended.json()).toMatchObject({
      activeTo: '2026-09-30',
      payDays: [10, 25],
      grossAmount: '1000',
    });
    // Only the merged row is inverted, so the contract lets it through and the use case answers.
    const bad = await authed(app, 'PATCH', `/income-sources/${dto.id}`, { activeTo: '2025-01-01' });
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe('active_period_invalid');
  });

  it('refuses to change the currency or delete a source that has inflows', async () => {
    const { app, repos } = setup();
    const dto = await (await create(app, salary)).json();
    repos.incomeSources.inflowCountOf = (id) => (id === dto.id ? 2 : 0);
    const currency = await authed(app, 'PATCH', `/income-sources/${dto.id}`, { currency: 'EUR' });
    expect(currency.status).toBe(409);
    expect((await currency.json()).code).toBe('source_has_inflows');
    expect(
      (await authed(app, 'PATCH', `/income-sources/${dto.id}`, { name: 'Renamed' })).status,
    ).toBe(200);
    const del = await authed(app, 'DELETE', `/income-sources/${dto.id}`);
    expect(del.status).toBe(409);
    expect((await del.json()).code).toBe('source_has_inflows');
  });

  it('deletes a source without inflows and answers 404 for strangers and unknown ids', async () => {
    const { app } = setup();
    const dto = await (await create(app, salary)).json();
    expect(
      (await authed(app, 'PATCH', `/income-sources/${dto.id}`, { name: 'X' }, OTHER)).status,
    ).toBe(404);
    expect(
      (await authed(app, 'DELETE', `/income-sources/${dto.id}`, undefined, OTHER)).status,
    ).toBe(404);
    expect((await authed(app, 'DELETE', `/income-sources/${dto.id}`)).status).toBe(204);
    expect((await authed(app, 'DELETE', `/income-sources/${dto.id}`)).status).toBe(404);
    expect((await authed(app, 'PATCH', `/income-sources/${dto.id}`, { name: 'X' })).status).toBe(
      404,
    );
  });

  it('requires a session', async () => {
    const { app } = setup();
    expect((await app.request('/income-sources')).status).toBe(401);
  });
});
