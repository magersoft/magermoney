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
});
