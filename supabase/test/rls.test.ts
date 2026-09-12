import { describe, expect, it, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const anon = process.env.SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
async function userClient(email: string) {
  const admin = createClient(url, service);
  const { data } = await admin.auth.admin.createUser({
    email,
    password: 'pw-123456',
    email_confirm: true,
  });
  const c = createClient(url, anon);
  await c.auth.signInWithPassword({ email, password: 'pw-123456' });
  return { c, id: data.user!.id };
}

describe('RLS', () => {
  let a: Awaited<ReturnType<typeof userClient>>;
  let b: typeof a;
  beforeAll(async () => {
    a = await userClient(`a-${Date.now()}@test.local`);
    b = await userClient(`b-${Date.now()}@test.local`);
  });

  it('creates a profile on signup and hides it from others', async () => {
    expect((await a.c.from('profiles').select('id').eq('id', a.id)).data).toHaveLength(1);
    expect((await b.c.from('profiles').select('id').eq('id', a.id)).data).toHaveLength(0);
  });

  it('shares api rates but isolates manual rates', async () => {
    await a.c.from('rates').insert({
      base: 'RUB',
      value: '0.0123',
      date: '2026-01-01',
      source: 'manual',
      user_id: a.id,
    });
    const seen = (await b.c.from('rates').select('source').eq('date', '2026-01-01')).data ?? [];
    expect(seen.every((r) => r.source === 'api')).toBe(true);
    const mine =
      (await a.c.from('rates').select('source').eq('date', '2026-01-01').eq('source', 'manual'))
        .data ?? [];
    expect(mine).toHaveLength(1);
  });

  it('refuses a manual rate for another user', async () => {
    const { error } = await a.c
      .from('rates')
      .insert({ base: 'RUB', value: '1', date: '2026-01-02', source: 'manual', user_id: b.id });
    expect(error).not.toBeNull();
  });

  it('isolates accounts and balance entries between users', async () => {
    const { data: acc, error } = await a.c
      .from('accounts')
      .insert({
        user_id: a.id,
        name: 'Alfa',
        bank: 'Alfa',
        country: 'RU',
        currency: 'RUB',
        kind: 'bank_account',
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    await a.c.from('balance_entries').insert({
      user_id: a.id,
      account_id: acc!.id,
      amount: '10',
      recorded_at: new Date().toISOString(),
      origin: 'manual',
    });
    expect((await b.c.from('accounts').select('id').eq('id', acc!.id)).data).toHaveLength(0);
    expect(
      (await b.c.from('balance_entries').select('id').eq('account_id', acc!.id)).data,
    ).toHaveLength(0);
    const forged = await b.c.from('accounts').insert({
      user_id: a.id,
      name: 'X',
      bank: 'X',
      country: 'RU',
      currency: 'RUB',
      kind: 'cash',
    });
    expect(forged.error).not.toBeNull();
  });

  it('refuses card fields on a non-card and a transfer to the same account', async () => {
    const bad = await a.c.from('accounts').insert({
      user_id: a.id,
      name: 'C',
      bank: 'C',
      country: 'RU',
      currency: 'RUB',
      kind: 'cash',
      card_last4: '1234',
    });
    expect(bad.error).not.toBeNull();
    const { data: acc } = await a.c
      .from('accounts')
      .insert({ user_id: a.id, name: 'S', bank: 'S', country: 'RU', currency: 'RUB', kind: 'cash' })
      .select('id')
      .single();
    const same = await a.c.from('transfers').insert({
      user_id: a.id,
      from_account_id: acc!.id,
      to_account_id: acc!.id,
      amount_sent: '1',
      amount_received: '1',
      occurred_at: new Date().toISOString(),
    });
    expect(same.error).not.toBeNull();
  });
});
