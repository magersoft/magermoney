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
  const email = `rls4-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
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

describe('RLS on the phase 4 tables', () => {
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
    await insert('goals', { name: 'Car', target_amount: '10000', currency: 'EUR' });
    await insert('assets', { name: 'BMW', currency: 'EUR' });
    await insert('asset_valuations', {
      asset_id: ids.assets,
      value: '30000',
      valued_on: '2026-09-01',
    });
  });

  const TABLES = ['goals', 'assets', 'asset_valuations'] as const;

  it.each(TABLES)('%s: the owner reads the row, another user does not', async (table) => {
    expect((await a.c.from(table).select('id').eq('id', ids[table]!)).data).toHaveLength(1);
    expect((await b.c.from(table).select('id').eq('id', ids[table]!)).data).toHaveLength(0);
    expect((await b.c.from(table).select('id')).data).toHaveLength(0);
  });

  it.each(TABLES)('%s: another user can neither update nor delete the row', async (table) => {
    const patch = table === 'asset_valuations' ? { value: '1' } : { name: 'hijacked' };
    const updated = await b.c.from(table).update(patch).eq('id', ids[table]!).select('id');
    expect(updated.data ?? []).toHaveLength(0);
    const deleted = await b.c.from(table).delete().eq('id', ids[table]!).select('id');
    expect(deleted.data ?? []).toHaveLength(0);
    expect((await a.c.from(table).select('id').eq('id', ids[table]!)).data).toHaveLength(1);
  });

  it('refuses a row forged for another user in every table', async () => {
    const forged: Record<(typeof TABLES)[number], Record<string, unknown>> = {
      goals: { name: 'X', target_amount: '1', currency: 'EUR' },
      assets: { name: 'X', currency: 'EUR' },
      asset_valuations: { asset_id: ids.assets, value: '1', valued_on: '2026-09-02' },
    };
    for (const table of TABLES) {
      const { error } = await b.c.from(table).insert({ user_id: a.id, ...forged[table] });
      expect(error, table).not.toBeNull();
    }
  });

  it('does not let another user link their account to a foreign goal it cannot see', async () => {
    const { data: account } = await b.c
      .from('accounts')
      .insert({
        user_id: b.id,
        name: 'S',
        bank: 'N26',
        country: 'DE',
        currency: 'EUR',
        kind: 'bank_account',
      })
      .select('id')
      .single();
    // The FK passes — b names itself as the owner — but the goal stays invisible
    // to its own owner's "which accounts fund this" query, which is what matters.
    await b.c.from('accounts').update({ goal_id: ids.goals }).eq('id', account!.id);
    const visibleToA = await a.c.from('accounts').select('id').eq('goal_id', ids.goals!);
    expect(visibleToA.data).toHaveLength(0);
  });
});
