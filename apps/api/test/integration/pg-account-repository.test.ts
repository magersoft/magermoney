import { beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../../src/shared/db/client.js';
import { pgRepos } from '../../src/shared/db/pg-unit-of-work.js';
import { createClient } from '@supabase/supabase-js';

const sql = createDb(process.env.DATABASE_URL!);
const repos = pgRepos(sql);
const newAccount = {
  name: 'Alfa',
  bank: 'Alfa',
  country: 'RU',
  currency: 'RUB',
  kind: 'bank_account' as const,
  cardType: null,
  isSpending: false,
  cardLast4: null,
  cardNetwork: null,
  cardTier: null,
  cardExpires: null,
  note: null,
  sortOrder: 0,
};

async function newUser(): Promise<string> {
  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await admin.auth.admin.createUser({
    email: `pg-${Date.now()}-${Math.random()}@test.local`,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user!.id;
}

describe('PgAccountRepository', () => {
  let uid: string;
  let other: string;
  beforeAll(async () => {
    uid = await newUser();
    other = await newUser();
  });

  it('creates with an opening balance and joins the latest entry (recorded_at desc, created_at desc)', async () => {
    const a = await repos.accounts.create(uid, newAccount, {
      amount: '100',
      recordedAt: '2026-09-01T00:00:00.000Z',
    });
    expect(a).toMatchObject({
      balance: '100',
      balanceRecordedAt: '2026-09-01T00:00:00.000Z',
      cardExpires: null,
      archivedAt: null,
    });
    await repos.balances.insert(uid, {
      accountId: a.id,
      amount: '2',
      recordedAt: '2026-09-02T00:00:00.000Z',
      origin: 'manual',
      transferId: null,
      note: null,
    });
    await repos.balances.insert(uid, {
      accountId: a.id,
      amount: '3',
      recordedAt: '2026-09-02T00:00:00.000Z',
      origin: 'manual',
      transferId: null,
      note: null,
    });
    expect((await repos.accounts.findById(uid, a.id))?.balance).toBe('3');
    expect(await repos.accounts.findById(other, a.id)).toBeNull();
    expect(await repos.accounts.countEntries(uid, a.id)).toBe(3);
  });

  it('persists a note on the opening balance entry', async () => {
    const a = await repos.accounts.create(
      uid,
      { ...newAccount, name: 'Noted' },
      {
        amount: '5',
        recordedAt: '2026-09-01T00:00:00.000Z',
        note: 'Imported from spreadsheet',
      },
    );
    const [entry] = await repos.balances.listByAccount(uid, a.id, 10);
    expect(entry?.note).toBe('Imported from spreadsheet');
  });

  it('paginates balances by cursor and round-trips a card date', async () => {
    const card = await repos.accounts.create(uid, {
      ...newAccount,
      name: 'Card',
      kind: 'card',
      cardType: 'debit',
      cardLast4: '5520',
      cardExpires: '2027-07-31',
    });
    expect(card.cardExpires).toBe('2027-07-31');
    const e1 = await repos.balances.insert(uid, {
      accountId: card.id,
      amount: '1',
      recordedAt: '2026-09-01T00:00:00.000Z',
      origin: 'manual',
      transferId: null,
      note: null,
    });
    const e2 = await repos.balances.insert(uid, {
      accountId: card.id,
      amount: '2',
      recordedAt: '2026-09-02T00:00:00.000Z',
      origin: 'manual',
      transferId: null,
      note: null,
    });
    const page1 = await repos.balances.listByAccount(uid, card.id, 1);
    expect(page1.map((e) => e.id)).toEqual([e2.id]);
    const page2 = await repos.balances.listByAccount(uid, card.id, 1, `${e2.recordedAt}|${e2.id}`);
    expect(page2.map((e) => e.id)).toEqual([e1.id]);
  });

  it('paginates balances with a tied recordedAt across pages without loss or duplication', async () => {
    const card = await repos.accounts.create(uid, { ...newAccount, name: 'Tied' });
    const tied = '2026-09-05T00:00:00.000Z';
    const e1 = await repos.balances.insert(uid, {
      accountId: card.id,
      amount: '1',
      recordedAt: tied,
      origin: 'manual',
      transferId: null,
      note: null,
    });
    const e2 = await repos.balances.insert(uid, {
      accountId: card.id,
      amount: '2',
      recordedAt: tied,
      origin: 'manual',
      transferId: null,
      note: null,
    });
    // Same instant for both rows: order is (created_at desc, id desc), so e2 (inserted second) comes first.
    const page1 = await repos.balances.listByAccount(uid, card.id, 1);
    expect(page1.map((e) => e.id)).toEqual([e2.id]);
    const page2 = await repos.balances.listByAccount(
      uid,
      card.id,
      1,
      `${page1[0]!.recordedAt}|${page1[0]!.id}`,
    );
    expect(page2.map((e) => e.id)).toEqual([e1.id]);
    const allIds = [...page1, ...page2].map((e) => e.id).sort();
    expect(allIds).toEqual([e1.id, e2.id].sort());
  });

  it('reorders, archives, refuses delete with transfers, cascades entries otherwise', async () => {
    const a = await repos.accounts.create(uid, { ...newAccount, name: 'A', currency: 'USD' });
    const b = await repos.accounts.create(uid, { ...newAccount, name: 'B', currency: 'USD' });
    expect(await repos.accounts.reorder(uid, [b.id, a.id])).toBe(true);
    expect((await repos.accounts.findById(uid, b.id))?.sortOrder).toBe(0);
    expect((await repos.accounts.findById(uid, a.id))?.sortOrder).toBe(1);
    expect(await repos.accounts.reorder(other, [b.id])).toBe(false);
    expect(
      (await repos.accounts.setArchived(uid, a.id, '2026-09-11T00:00:00.000Z'))?.archivedAt,
    ).toBe('2026-09-11T00:00:00.000Z');
    const t = await repos.transfers.insert(uid, {
      fromAccountId: a.id,
      toAccountId: b.id,
      amountSent: '1',
      amountReceived: '1',
      occurredAt: '2026-09-03T00:00:00.000Z',
      note: null,
    });
    expect(await repos.accounts.delete(uid, a.id)).toBe('has_transfers');
    expect(await repos.transfers.countByAccount(uid, a.id)).toBe(1);
    await repos.transfers.delete(uid, t.id);
    await repos.balances.insert(uid, {
      accountId: a.id,
      amount: '1',
      recordedAt: '2026-09-04T00:00:00.000Z',
      origin: 'manual',
      transferId: null,
      note: null,
    });
    expect(await repos.accounts.delete(uid, a.id)).toBe('deleted');
    expect(await repos.balances.listByAccount(uid, a.id, 10)).toEqual([]);
    expect(await repos.accounts.delete(uid, a.id)).toBe('not_found');
  });
});
