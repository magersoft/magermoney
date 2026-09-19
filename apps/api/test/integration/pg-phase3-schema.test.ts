import { beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createDb } from '../../src/shared/db/client.js';

const sql = createDb(process.env.DATABASE_URL!);
let uid: string;
let accountId: string;
let sourceId: string;

const source = (over: Record<string, unknown> = {}) => ({
  user_id: uid,
  name: 'Salary',
  gross_amount: '1000',
  currency: 'USD',
  active_from: '2026-01-01',
  ...over,
});
const rejects = (p: Promise<unknown>) => expect(p).rejects.toThrow();

describe('phase 3 schema', () => {
  beforeAll(async () => {
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data } = await admin.auth.admin.createUser({
      email: `p3-schema-${Date.now()}@test.local`,
      email_confirm: true,
    });
    uid = data.user!.id;
    const [acc] = await sql<{ id: string }[]>`
      insert into accounts (user_id, name, bank, country, currency, kind)
      values (${uid}, 'Main', 'Bank', 'RU', 'USD', 'bank_account') returning id`;
    accountId = acc!.id;
    const [src] = await sql<{ id: string }[]>`
      insert into income_sources ${sql(source({ pay_days: '{10,25}', is_primary: true }))} returning id`;
    sourceId = src!.id;
  });

  it('income_sources: defaults, pay day range, rate range, period order, one primary', async () => {
    const [row] = await sql<{ payDays: number[]; taxRate: string; isPrimary: boolean }[]>`
      insert into income_sources ${sql(source({ name: 'Side' }))} returning pay_days, tax_rate, is_primary`;
    expect(row).toMatchObject({ payDays: [], taxRate: '0', isPrimary: false });
    await rejects(sql`insert into income_sources ${sql(source({ pay_days: '{0}' }))}`);
    await rejects(sql`insert into income_sources ${sql(source({ pay_days: '{32}' }))}`);
    await rejects(sql`insert into income_sources ${sql(source({ tax_rate: '1' }))}`);
    await rejects(sql`insert into income_sources ${sql(source({ commission_rate: '-0.1' }))}`);
    await rejects(sql`insert into income_sources ${sql(source({ gross_amount: '-1' }))}`);
    await rejects(sql`insert into income_sources ${sql(source({ active_to: '2025-12-31' }))}`);
    await rejects(
      sql`insert into income_sources ${sql(source({ name: 'Second primary', is_primary: true }))}`,
    );
  });

  it('inflows: positive amount, account and credited amount come together', async () => {
    const inflow = (over: Record<string, unknown> = {}) => ({
      user_id: uid,
      income_source_id: sourceId,
      amount: '100',
      currency: 'USD',
      received_on: '2026-09-10',
      ...over,
    });
    await sql`insert into inflows ${sql(inflow())}`;
    await rejects(sql`insert into inflows ${sql(inflow({ amount: '0' }))}`);
    await rejects(sql`insert into inflows ${sql(inflow({ account_id: accountId }))}`);
    await rejects(sql`insert into inflows ${sql(inflow({ credited_amount: '100' }))}`);
    await rejects(
      sql`insert into inflows ${sql(inflow({ account_id: accountId, credited_amount: '0' }))}`,
    );
    await rejects(sql`insert into inflows ${sql(inflow({ realised_rate_to_usd: '0' }))}`);
    await rejects(sql`delete from income_sources where id = ${sourceId}`);
  });

  it('balance_entries: an inflow entry names its inflow, cascades with it, is unique per inflow, and refuses deleting the credited account', async () => {
    const [inflow] = await sql<{ id: string }[]>`
      insert into inflows (user_id, income_source_id, amount, currency, received_on, account_id, credited_amount)
      values (${uid}, ${sourceId}, '50', 'USD', '2026-09-11', ${accountId}, '50') returning id`;
    const entry = (over: Record<string, unknown>) => ({
      user_id: uid,
      account_id: accountId,
      amount: '50',
      recorded_at: '2026-09-11T10:00:00.000Z',
      ...over,
    });
    await rejects(sql`insert into balance_entries ${sql(entry({ origin: 'inflow' }))}`);
    await rejects(
      sql`insert into balance_entries ${sql(entry({ origin: 'manual', inflow_id: inflow!.id }))}`,
    );
    await sql`insert into balance_entries ${sql(entry({ origin: 'inflow', inflow_id: inflow!.id }))}`;
    await rejects(
      sql`insert into balance_entries ${sql(entry({ origin: 'inflow', inflow_id: inflow!.id, recorded_at: '2026-09-11T11:00:00.000Z' }))}`,
    );
    await rejects(sql`delete from accounts where id = ${accountId}`);
    await sql`delete from inflows where id = ${inflow!.id}`;
    const left = await sql`select id from balance_entries where inflow_id = ${inflow!.id}`;
    expect(left).toHaveLength(0);
  });

  it('expenses: category names are unique per user ignoring case; billing month only on yearly', async () => {
    const [cat] = await sql<{ id: string }[]>`
      insert into expense_categories (user_id, name) values (${uid}, 'Housing') returning id`;
    await rejects(sql`insert into expense_categories (user_id, name) values (${uid}, 'housing')`);
    const expense = (over: Record<string, unknown> = {}) => ({
      user_id: uid,
      category_id: cat!.id,
      name: 'Rent',
      amount: '900',
      currency: 'EUR',
      period: 'monthly',
      active_from: '2026-01-01',
      ...over,
    });
    await sql`insert into expenses ${sql(expense({ billing_day: 5 }))}`;
    await sql`insert into expenses ${sql(expense({ name: 'Insurance', period: 'yearly', billing_day: 1, billing_month: 3 }))}`;
    await rejects(sql`insert into expenses ${sql(expense({ billing_month: 3 }))}`);
    await rejects(sql`insert into expenses ${sql(expense({ billing_day: 32 }))}`);
    await rejects(sql`insert into expenses ${sql(expense({ amount: '-1' }))}`);
    await rejects(sql`insert into expenses ${sql(expense({ active_to: '2025-01-01' }))}`);
    await rejects(sql`delete from expense_categories where id = ${cat!.id}`);
  });

  it('budgets: a limit is never negative', async () => {
    const budget = (over: Record<string, unknown> = {}) => ({
      user_id: uid,
      name: 'Groceries',
      monthly_limit: '1000',
      currency: 'EUR',
      active_from: '2026-01-01',
      ...over,
    });
    await sql`insert into budgets ${sql(budget())}`;
    await rejects(sql`insert into budgets ${sql(budget({ monthly_limit: '-1' }))}`);
    await rejects(sql`insert into budgets ${sql(budget({ active_to: '2025-01-01' }))}`);
  });
});
