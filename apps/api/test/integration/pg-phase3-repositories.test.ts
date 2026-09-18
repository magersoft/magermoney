import { beforeAll, describe, expect, it } from 'vitest';
import { createIncomeSource } from '../../src/modules/income-sources/application/create-income-source.js';
import { createInflow } from '../../src/modules/inflows/application/create-inflow.js';
import { deps, newUser, salary, sql, usd } from './helpers.js';

const { repos } = deps;

describe('phase 3 pg repositories', () => {
  let uid: string;
  let other: string;
  beforeAll(async () => {
    uid = await newUser('repo');
    other = await newUser('repo');
  });

  it('categories: unique per user case-insensitively, ordered, restricted delete', async () => {
    const housing = await repos.expenseCategories.insert(uid, {
      name: 'Housing',
      icon: null,
      sortOrder: 1,
    });
    const subs = await repos.expenseCategories.insert(uid, {
      name: 'Subscriptions',
      icon: 'lucide:tv',
      sortOrder: 0,
    });
    if (housing === 'name_taken' || subs === 'name_taken') throw new Error('unexpected name_taken');
    expect(
      await repos.expenseCategories.insert(uid, { name: 'HOUSING', icon: null, sortOrder: 2 }),
    ).toBe('name_taken');
    // The same name is free for another user.
    expect(
      await repos.expenseCategories.insert(other, { name: 'Housing', icon: null, sortOrder: 0 }),
    ).not.toBe('name_taken');
    expect((await repos.expenseCategories.list(uid)).map((c) => c.name)).toEqual([
      'Subscriptions',
      'Housing',
    ]);
    expect((await repos.expenseCategories.findByName(uid, '  housing '))?.id).toBe(housing.id);
    expect(await repos.expenseCategories.findById(other, housing.id)).toBeNull();
    expect(await repos.expenseCategories.update(uid, subs.id, { name: 'housing' })).toBe(
      'name_taken',
    );
    expect(
      await repos.expenseCategories.update(uid, subs.id, { name: 'Subs', sortOrder: 5 }),
    ).toMatchObject({
      name: 'Subs',
      sortOrder: 5,
      icon: 'lucide:tv',
    });
    expect(await repos.expenseCategories.update(other, subs.id, { name: 'X' })).toBeNull();

    await repos.expenses.insert(uid, {
      categoryId: housing.id,
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
    expect(await repos.expenseCategories.delete(uid, housing.id)).toBe('has_expenses');
    expect(await repos.expenseCategories.delete(other, subs.id)).toBe('not_found');
    expect(await repos.expenseCategories.delete(uid, subs.id)).toBe('deleted');
  });

  it('expenses: dates and numerics round-trip as strings, patch clears nullable columns', async () => {
    const cat = await repos.expenseCategories.insert(uid, {
      name: 'Software',
      icon: null,
      sortOrder: 9,
    });
    if (cat === 'name_taken') throw new Error('unexpected name_taken');
    const created = await repos.expenses.insert(uid, {
      categoryId: cat.id,
      name: 'IDE licence',
      amount: '45.480000000000000001',
      currency: 'EUR',
      period: 'yearly',
      billingDay: 31,
      billingMonth: 12,
      isEssential: false,
      activeFrom: '2026-01-01',
      activeTo: '2026-12-31',
    });
    expect(created).toMatchObject({
      amount: '45.480000000000000001',
      period: 'yearly',
      billingDay: 31,
      billingMonth: 12,
      activeFrom: '2026-01-01',
      activeTo: '2026-12-31',
    });
    const patched = await repos.expenses.update(uid, created.id, {
      period: 'monthly',
      billingMonth: null,
      activeTo: null,
    });
    expect(patched).toMatchObject({
      period: 'monthly',
      billingMonth: null,
      activeTo: null,
      billingDay: 31,
    });
    expect(await repos.expenses.countByCategory(uid, cat.id)).toBe(1);
    expect(await repos.expenses.findById(other, created.id)).toBeNull();
    expect(await repos.expenses.update(other, created.id, { name: 'X' })).toBeNull();
    expect(await repos.expenses.delete(other, created.id)).toBe(false);
    expect((await repos.expenses.list(uid)).some((e) => e.id === created.id)).toBe(true);
    expect(await repos.expenses.delete(uid, created.id)).toBe(true);
    expect(await repos.expenses.countByCategory(uid, cat.id)).toBe(0);
  });

  it('expenses: the table refuses billing_month on a monthly row', async () => {
    const cat = await repos.expenseCategories.insert(uid, {
      name: 'Checks',
      icon: null,
      sortOrder: 10,
    });
    if (cat === 'name_taken') throw new Error('unexpected name_taken');
    await expect(
      repos.expenses.insert(uid, {
        categoryId: cat.id,
        name: 'Broken',
        amount: '1',
        currency: 'EUR',
        period: 'monthly',
        billingDay: null,
        billingMonth: 3,
        isEssential: false,
        activeFrom: '2026-01-01',
        activeTo: null,
      }),
    ).rejects.toThrow();
  });

  it('budgets: round-trip, patch, isolation, delete', async () => {
    const b = await repos.budgets.insert(uid, {
      name: 'Groceries',
      icon: null,
      monthlyLimit: '600.00',
      currency: 'EUR',
      activeFrom: '2026-09-01',
      activeTo: null,
    });
    expect(b).toMatchObject({ monthlyLimit: '600.00', activeFrom: '2026-09-01', activeTo: null });
    expect(
      await repos.budgets.update(uid, b.id, { monthlyLimit: '750', activeTo: '2026-12-31' }),
    ).toMatchObject({
      monthlyLimit: '750',
      activeTo: '2026-12-31',
    });
    expect(await repos.budgets.findById(other, b.id)).toBeNull();
    expect(await repos.budgets.list(other)).toEqual([]);
    expect(await repos.budgets.delete(other, b.id)).toBe(false);
    expect(await repos.budgets.delete(uid, b.id)).toBe(true);
  });

  it('income sources and inflows: a credited inflow persists with its balance entry', async () => {
    const source = (await createIncomeSource(deps)(uid, salary))._unsafeUnwrap();
    expect(source).toMatchObject({
      payDays: [10, 25],
      activeFrom: '2026-01-01',
      activeTo: null,
      netMonthly: '1000',
    });
    const account = await repos.accounts.create(uid, usd('Payroll'), {
      amount: '100',
      recordedAt: '2026-09-01T00:00:00.000Z',
    });
    const inflow = (
      await createInflow(deps)(uid, {
        incomeSourceId: source.id,
        amount: '50',
        accountId: account.id,
      })
    )._unsafeUnwrap();
    expect(inflow).toMatchObject({
      amount: '50',
      currency: 'USD',
      accountId: account.id,
      creditedAmount: '50',
    });
    expect((await repos.accounts.findById(uid, account.id))?.balance).toBe('150');
    const entries = await sql<{ origin: string; inflowId: string | null; amount: string }[]>`
      select origin, inflow_id, amount::text as amount from balance_entries
      where user_id = ${uid} and account_id = ${account.id} order by recorded_at desc, created_at desc limit 1`;
    expect(entries[0]).toEqual({ origin: 'inflow', inflowId: inflow.id, amount: '150' });
    // The account can no longer be deleted: an inflow points at it.
    expect(await repos.accounts.delete(uid, account.id)).toBe('has_inflows');
    // Nor can the income source it came from: an inflow still points at it.
    expect(await repos.incomeSources.delete(uid, source.id)).toBe('has_inflows');
    expect(await repos.incomeSources.findById(uid, source.id)).not.toBeNull();
  });

  it('income sources: an empty pay_days array round-trips through the hand-built int[] literal', async () => {
    const inserted = await repos.incomeSources.insert(uid, {
      name: 'Freelance',
      grossAmount: '500',
      currency: 'USD',
      taxRate: '0',
      commissionRate: '0',
      payDays: [],
      isPrimary: false,
      activeFrom: '2026-01-01',
      activeTo: null,
      defaultAccountId: null,
    });
    expect(inserted.payDays).toEqual([]);
    expect((await repos.incomeSources.findById(uid, inserted.id))?.payDays).toEqual([]);
    const updated = await repos.incomeSources.update(uid, inserted.id, {
      ...inserted,
      payDays: [15],
    });
    expect(updated?.payDays).toEqual([15]);
    const cleared = await repos.incomeSources.update(uid, inserted.id, {
      ...inserted,
      payDays: [],
    });
    expect(cleared?.payDays).toEqual([]);
  });
});
