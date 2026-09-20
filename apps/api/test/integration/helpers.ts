import { CurrencyRegistry, SystemClock } from '@magermoney/domain';
import { createClient } from '@supabase/supabase-js';
import { createDb } from '../../src/shared/db/client.js';
import { pgRepos, pgUnitOfWork } from '../../src/shared/db/pg-unit-of-work.js';

export const sql = createDb(process.env.DATABASE_URL!);
/** The dependency bag every phase 2–3 use case accepts. */
export const deps = {
  uow: pgUnitOfWork(sql),
  repos: pgRepos(sql),
  registry: CurrencyRegistry.sample(),
  clock: new SystemClock(),
};

export async function newUser(prefix = 'p3'): Promise<string> {
  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await admin.auth.admin.createUser({
    email: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user!.id;
}

export const usd = (name: string) => ({
  name,
  bank: 'B',
  country: 'US',
  currency: 'USD',
  kind: 'bank_account' as const,
  cardType: null,
  isSpending: false,
  isPinned: false,
  cardLast4: null,
  cardNetwork: null,
  cardTier: null,
  cardExpires: null,
  colorway: null,
  note: null,
  sortOrder: 0,
});

export const salary = {
  name: 'Salary',
  grossAmount: '1000',
  currency: 'USD',
  taxRate: '0',
  commissionRate: '0',
  payDays: [10, 25],
  isPrimary: false,
  activeFrom: '2026-01-01',
};
