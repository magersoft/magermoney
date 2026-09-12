import { describe, expect, it } from 'vitest';
import { CurrencyRegistry, SystemClock } from '@magermoney/domain';
import { createClient } from '@supabase/supabase-js';
import { createDb } from '../../src/shared/db/client.js';
import { pgRepos, pgUnitOfWork } from '../../src/shared/db/pg-unit-of-work.js';
import { createTransfer } from '../../src/modules/transfers/application/create-transfer.js';

const sql = createDb(process.env.DATABASE_URL!);
const deps = {
  uow: pgUnitOfWork(sql),
  repos: pgRepos(sql),
  registry: CurrencyRegistry.default(),
  clock: new SystemClock(),
};
const acc = (name: string) => ({
  name,
  bank: 'B',
  country: 'RU',
  currency: 'USD',
  kind: 'bank_account' as const,
  cardType: null,
  isSpending: false,
  cardLast4: null,
  cardNetwork: null,
  cardTier: null,
  cardExpires: null,
  note: null,
  sortOrder: 0,
});

describe('transfers under concurrency', () => {
  it('two simultaneous transfers from one account never overdraw it', async () => {
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data } = await admin.auth.admin.createUser({
      email: `cc-${Date.now()}@test.local`,
      email_confirm: true,
    });
    const uid = data.user!.id;
    const from = await deps.repos.accounts.create(uid, acc('from'), {
      amount: '100',
      recordedAt: '2026-09-01T00:00:00.000Z',
    });
    const to = await deps.repos.accounts.create(uid, acc('to'));
    const run = () =>
      createTransfer(deps)(uid, { fromAccountId: from.id, toAccountId: to.id, amountSent: '70' });
    const [r1, r2] = await Promise.all([run(), run()]);
    expect([r1.isOk(), r2.isOk()].filter(Boolean)).toHaveLength(1);
    const after = await deps.repos.accounts.findById(uid, from.id);
    expect(after?.balance).toBe('30');
    expect(await deps.repos.transfers.countByAccount(uid, from.id)).toBe(1);
  });
});
