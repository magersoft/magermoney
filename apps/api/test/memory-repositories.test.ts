import { describe, expect, it } from 'vitest';
import { MemoryAccountRepository } from '../src/modules/accounts/infrastructure/memory-account-repository.js';
import { MemoryBalanceRepository } from '../src/modules/accounts/infrastructure/memory-balance-repository.js';

const uid = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const newAccount = {
  name: 'Alfa',
  bank: 'Alfa',
  country: 'RU',
  currency: 'RUB',
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
};

describe('memory repositories', () => {
  it('lists an account with its latest balance by recordedAt then createdAt', async () => {
    const balances = new MemoryBalanceRepository();
    const accounts = new MemoryAccountRepository(balances);
    const a = await accounts.create(uid, newAccount);
    await balances.insert(uid, {
      accountId: a.id,
      amount: '1',
      recordedAt: '2026-09-01T00:00:00.000Z',
      origin: 'manual',
      transferId: null,
      note: null,
    });
    await balances.insert(uid, {
      accountId: a.id,
      amount: '2',
      recordedAt: '2026-09-02T00:00:00.000Z',
      origin: 'manual',
      transferId: null,
      note: null,
    });
    await balances.insert(uid, {
      accountId: a.id,
      amount: '3',
      recordedAt: '2026-09-02T00:00:00.000Z',
      origin: 'manual',
      transferId: null,
      note: null,
    });
    const [row] = await accounts.list(uid);
    expect(row?.balance).toBe('3');
    expect(await accounts.list(other)).toEqual([]);
    expect(await accounts.findById(other, a.id)).toBeNull();
  });
  it('lists balances newest first with a cursor', async () => {
    const balances = new MemoryBalanceRepository();
    const accounts = new MemoryAccountRepository(balances);
    const a = await accounts.create(uid, newAccount);
    const e1 = await balances.insert(uid, {
      accountId: a.id,
      amount: '1',
      recordedAt: '2026-09-01T00:00:00.000Z',
      origin: 'manual',
      transferId: null,
      note: null,
    });
    const e2 = await balances.insert(uid, {
      accountId: a.id,
      amount: '2',
      recordedAt: '2026-09-02T00:00:00.000Z',
      origin: 'manual',
      transferId: null,
      note: null,
    });
    expect((await balances.listByAccount(uid, a.id, 10)).map((e) => e.id)).toEqual([e2.id, e1.id]);
    expect(
      (await balances.listByAccount(uid, a.id, 10, `${e2.recordedAt}|${e2.id}`)).map((e) => e.id),
    ).toEqual([e1.id]);
  });
  it('persists a note on the opening balance entry', async () => {
    const balances = new MemoryBalanceRepository();
    const accounts = new MemoryAccountRepository(balances);
    const a = await accounts.create(uid, newAccount, {
      amount: '5',
      recordedAt: '2026-09-01T00:00:00.000Z',
      note: 'Imported from spreadsheet',
    });
    const [entry] = await balances.listByAccount(uid, a.id, 10);
    expect(entry?.note).toBe('Imported from spreadsheet');
  });
  it('delete reports transfers and cascades entries', async () => {
    const balances = new MemoryBalanceRepository();
    const accounts = new MemoryAccountRepository(balances);
    const a = await accounts.create(uid, newAccount, {
      amount: '5',
      recordedAt: '2026-09-01T00:00:00.000Z',
    });
    expect(await accounts.delete(uid, a.id)).toBe('deleted');
    expect(await balances.listByAccount(uid, a.id, 10)).toEqual([]);
    expect(await accounts.delete(uid, a.id)).toBe('not_found');
  });
});
