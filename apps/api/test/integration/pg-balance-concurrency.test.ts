import { describe, expect, it } from 'vitest';
import { CurrencyRegistry, SystemClock } from '@magermoney/domain';
import { createClient } from '@supabase/supabase-js';
import type { Repos } from '../../src/app.js';
import { createDb } from '../../src/shared/db/client.js';
import { pgRepos, pgUnitOfWork } from '../../src/shared/db/pg-unit-of-work.js';
import type { UnitOfWork } from '../../src/shared/db/unit-of-work.js';
import { editBalance } from '../../src/modules/accounts/application/edit-balance.js';
import { recordBalance } from '../../src/modules/accounts/application/record-balance.js';

const sql = createDb(process.env.DATABASE_URL!);

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

/**
 * Holds the edit between reading "which entry is latest" and writing it. Without
 * the account lock the concurrent `recordBalance` slips into that window and the
 * edit lands on an entry that is no longer the latest one; with the lock the
 * insert cannot start until the edit's transaction commits, so the gate simply
 * times out.
 */
const gatedUpdate = (repos: Repos, gate: Promise<void>): Repos => ({
  accounts: repos.accounts,
  transfers: repos.transfers,
  balances: new Proxy(repos.balances, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target) as unknown;
      if (prop === 'update')
        return async (...args: unknown[]) => {
          await gate;
          return (value as (...a: unknown[]) => unknown).apply(target, args);
        };
      return typeof value === 'function' ? (value as () => unknown).bind(target) : value;
    },
  }),
});

describe('balance writes under concurrency', () => {
  it('serialises an edit and a concurrent recordBalance on the same account', async () => {
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data } = await admin.auth.admin.createUser({
      email: `bc-${Date.now()}@test.local`,
      email_confirm: true,
    });
    const uid = data.user!.id;
    const repos = pgRepos(sql);
    const account = await repos.accounts.create(uid, acc('journal'), {
      amount: '100',
      recordedAt: '2026-09-01T00:00:00.000Z',
    });
    const first = (await repos.balances.latest(uid, account.id))!;

    let openGate = () => {};
    const gate = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    // The gate also opens on its own, so the fixed code (where the insert waits
    // on the lock) is not deadlocked by a record that can never finish.
    const timer = setTimeout(openGate, 500);

    const editDeps = {
      uow: ((fn) => pgUnitOfWork(sql)((r) => fn(gatedUpdate(r, gate)))) as UnitOfWork<Repos>,
      repos: gatedUpdate(repos, gate),
      registry: CurrencyRegistry.default(),
      clock: new SystemClock(),
    };
    const recordDeps = {
      uow: pgUnitOfWork(sql),
      repos,
      registry: CurrencyRegistry.default(),
      clock: new SystemClock(),
    };

    const order: string[] = [];
    const [edited] = await Promise.all([
      editBalance(editDeps)(uid, first.id, { amount: '150' }).then((r) => {
        order.push('edit');
        return r;
      }),
      recordBalance(recordDeps)(uid, account.id, { amount: '200' }).then((r) => {
        openGate();
        order.push('record');
        return r;
      }),
    ]);
    clearTimeout(timer);

    if (edited.isErr()) {
      // It saw the new entry: the only other allowed outcome.
      expect(edited.error).toMatchObject({ code: 'entry_not_latest' });
    } else {
      // It completed first: the insert could not have committed before it.
      expect(order[0]).toBe('edit');
      expect(edited.value.amount).toBe('150');
    }
    const entries = await repos.balances.listByAccount(uid, account.id, 10);
    expect(entries[0]?.amount).toBe('200');
  });
});
