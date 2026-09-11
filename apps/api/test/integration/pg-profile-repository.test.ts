import { describe, expect, it, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createDb } from '../../src/shared/db/client.js';
import { PgProfileRepository } from '../../src/modules/profiles/infrastructure/pg-profile-repository.js';

describe('PgProfileRepository', () => {
  const sql = createDb(process.env.DATABASE_URL!);
  const repo = new PgProfileRepository(sql);
  let id: string;
  beforeAll(async () => {
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data } = await admin.auth.admin.createUser({ email: `p-${Date.now()}@test.local`, password: 'pw-123456', email_confirm: true });
    id = data.user!.id;
  });
  it('reads the trigger-created profile and updates it', async () => {
    expect((await repo.findById(id))?.locale).toBe('ru');
    const updated = await repo.update(id, { locale: 'en', reportingCurrencies: ['USD'], defaultCurrency: 'USD' });
    expect(updated).toMatchObject({ locale: 'en', reportingCurrencies: ['USD'], defaultCurrency: 'USD' });
    expect(await repo.findById('00000000-0000-0000-0000-000000000000')).toBeNull();
  });
});
