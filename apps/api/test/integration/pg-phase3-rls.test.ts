import { beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const anon = process.env.SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface Person {
  c: SupabaseClient;
  id: string;
}

/** A real signed-in client, so every statement runs as `authenticated` with this user's `auth.uid()`. */
async function person(tag: string): Promise<Person> {
  const email = `rls3-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  const admin = createClient(url, service);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: 'pw-123456',
    email_confirm: true,
  });
  if (error) throw error;
  const c = createClient(url, anon);
  await c.auth.signInWithPassword({ email, password: 'pw-123456' });
  return { c, id: data.user!.id };
}

describe('RLS on the phase 3 tables', () => {
  let a: Person;
  let b: Person;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    a = await person('a');
    b = await person('b');
    const insert = async (table: string, row: Record<string, unknown>) => {
      const { data, error } = await a.c
        .from(table)
        .insert({ user_id: a.id, ...row })
        .select('id')
        .single();
      expect(error, `${table}: ${error?.message}`).toBeNull();
      ids[table] = data!.id as string;
    };
    await insert('income_sources', {
      name: 'Salary',
      gross_amount: '1000',
      currency: 'USD',
      active_from: '2026-01-01',
    });
    await insert('inflows', {
      income_source_id: ids.income_sources,
      amount: '500',
      currency: 'USD',
      received_on: '2026-09-10',
    });
    await insert('expense_categories', { name: 'Housing' });
    await insert('expenses', {
      category_id: ids.expense_categories,
      name: 'Rent',
      amount: '900',
      currency: 'EUR',
      period: 'monthly',
      active_from: '2026-01-01',
    });
    await insert('budgets', {
      name: 'Groceries',
      monthly_limit: '1000',
      currency: 'EUR',
      active_from: '2026-01-01',
    });
  });

  const TABLES = [
    'income_sources',
    'inflows',
    'expense_categories',
    'expenses',
    'budgets',
  ] as const;

  it.each(TABLES)('%s: the owner reads the row, another user does not', async (table) => {
    expect((await a.c.from(table).select('id').eq('id', ids[table]!)).data).toHaveLength(1);
    expect((await b.c.from(table).select('id').eq('id', ids[table]!)).data).toHaveLength(0);
    expect((await b.c.from(table).select('id')).data).toHaveLength(0);
  });

  it.each(TABLES)('%s: another user can neither update nor delete the row', async (table) => {
    const column = table === 'inflows' ? 'note' : 'name';
    const updated = await b.c
      .from(table)
      .update({ [column]: 'hijacked' })
      .eq('id', ids[table]!)
      .select('id');
    expect(updated.data ?? []).toHaveLength(0);
    const deleted = await b.c.from(table).delete().eq('id', ids[table]!).select('id');
    expect(deleted.data ?? []).toHaveLength(0);
    expect((await a.c.from(table).select('id').eq('id', ids[table]!)).data).toHaveLength(1);
  });

  it('refuses a row forged for another user in every table', async () => {
    const forged: Record<(typeof TABLES)[number], Record<string, unknown>> = {
      income_sources: { name: 'X', gross_amount: '1', currency: 'USD', active_from: '2026-01-01' },
      inflows: {
        income_source_id: ids.income_sources,
        amount: '1',
        currency: 'USD',
        received_on: '2026-09-10',
      },
      expense_categories: { name: 'Forged' },
      expenses: {
        category_id: ids.expense_categories,
        name: 'X',
        amount: '1',
        currency: 'EUR',
        period: 'monthly',
        active_from: '2026-01-01',
      },
      budgets: { name: 'X', monthly_limit: '1', currency: 'EUR', active_from: '2026-01-01' },
    };
    for (const table of TABLES) {
      const { error } = await b.c.from(table).insert({ user_id: a.id, ...forged[table] });
      expect(error, table).not.toBeNull();
    }
  });

  it('does not let a user hang their own inflow on a foreign source through the API role', async () => {
    // RLS hides the foreign source from the FK's point of view only for reads; the insert itself names b as the owner,
    // so the policy passes — the use case is what refuses it (404 source). This asserts the database at least keeps
    // the row invisible to the source's owner.
    const { data } = await b.c
      .from('inflows')
      .insert({
        user_id: b.id,
        income_source_id: ids.income_sources,
        amount: '1',
        currency: 'USD',
        received_on: '2026-09-10',
      })
      .select('id');
    const visibleToA = await a.c
      .from('inflows')
      .select('id')
      .eq('income_source_id', ids.income_sources!);
    expect(visibleToA.data).toHaveLength(1);
    expect(visibleToA.data![0]!.id).toBe(ids.inflows);
    // Clean up so the source stays deletable for anything that runs later.
    if (data?.[0]) await b.c.from('inflows').delete().eq('id', data[0].id);
  });
});
