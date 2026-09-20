import { describe, expect, it } from 'vitest';
import { CurrencyRegistry, SystemClock } from '@magermoney/domain';
import { createClient } from '@supabase/supabase-js';
import { createDb } from '../../src/shared/db/client.js';
import { pgRepos, pgUnitOfWork } from '../../src/shared/db/pg-unit-of-work.js';
import { deleteAccount } from '../../src/modules/accounts/application/delete-account.js';
import { createTransfer } from '../../src/modules/transfers/application/create-transfer.js';

const sql = createDb(process.env.DATABASE_URL!);
const deps = {
  uow: pgUnitOfWork(sql),
  repos: pgRepos(sql),
  registry: CurrencyRegistry.sample(),
  clock: new SystemClock(),
};

/** A unit of work that holds its transaction open after the work is done, so another one can race its commit. */
const slowCommit = (gate: Promise<void>) =>
  ((fn) =>
    pgUnitOfWork(sql)(async (repos) => {
      const result = await fn(repos);
      await gate;
      return result;
    })) as typeof deps.uow;
const acc = (name: string) => ({
  name,
  bank: 'B',
  country: 'RU',
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

describe('deleting an account under concurrency', () => {
  it('answers 409 or lets the transfer miss the account, never trips the foreign key', async () => {
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data } = await admin.auth.admin.createUser({
      email: `dc-${Date.now()}@test.local`,
      email_confirm: true,
    });
    const uid = data.user!.id;
    const from = await deps.repos.accounts.create(uid, acc('from'), {
      amount: '100',
      recordedAt: '2026-09-01T00:00:00.000Z',
    });
    const to = await deps.repos.accounts.create(uid, acc('to'));

    // The transfer writes its rows and then sits on its open transaction; the
    // delete must not be able to slip a committed `delete from accounts` into
    // that window, which is what breaks the foreign key.
    let openGate = () => {};
    const gate = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    const timer = setTimeout(openGate, 400);
    const transfer = createTransfer({ ...deps, uow: slowCommit(gate) })(uid, {
      fromAccountId: from.id,
      toAccountId: to.id,
      amountSent: '10',
    });
    await new Promise((r) => setTimeout(r, 50));
    const [removed, transferred] = await Promise.all([deleteAccount(deps)(uid, to.id), transfer]);
    clearTimeout(timer);

    if (removed.isOk()) {
      // The account is gone, so the transfer either committed first or found nothing.
      expect(await deps.repos.accounts.findById(uid, to.id)).toBeNull();
      expect(transferred.isErr()).toBe(true);
      if (transferred.isErr()) expect(transferred.error).toMatchObject({ code: 'NOT_FOUND' });
    } else {
      expect(removed.error).toMatchObject({ code: 'account_has_transfers' });
      expect(transferred.isOk()).toBe(true);
    }
  });
});
