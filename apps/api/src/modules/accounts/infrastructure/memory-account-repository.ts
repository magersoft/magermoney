import { randomUUID } from 'node:crypto';
import type {
  AccountPatch,
  AccountRepository,
  AccountRow,
  NewAccount,
  OpeningBalance,
} from '../application/account-repository.js';
import type { MemoryBalanceRepository } from './memory-balance-repository.js';

type Stored = Omit<AccountRow, 'balance' | 'balanceRecordedAt'>;

export class MemoryAccountRepository implements AccountRepository {
  public rows: Stored[] = [];
  /** Transfer counts per account, set by MemoryTransferRepository. */
  public transferCounts = new Map<string, number>();
  constructor(private readonly balances: MemoryBalanceRepository) {}

  private async withBalance(row: Stored): Promise<AccountRow> {
    const latest = await this.balances.latest(row.userId, row.id);
    return {
      ...row,
      balance: latest?.amount ?? null,
      balanceRecordedAt: latest?.recordedAt ?? null,
    };
  }
  private mine(userId: string) {
    return this.rows.filter((r) => r.userId === userId);
  }
  async list(userId: string) {
    const rows = [...this.mine(userId)].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
    return Promise.all(rows.map((r) => this.withBalance(r)));
  }
  async findById(userId: string, id: string) {
    const row = this.mine(userId).find((r) => r.id === id);
    return row ? this.withBalance(row) : null;
  }
  async lock(userId: string, ids: string[]) {
    const rows = this.mine(userId).filter((r) => ids.includes(r.id));
    return Promise.all(rows.map((r) => this.withBalance(r)));
  }
  async create(userId: string, data: NewAccount, opening?: OpeningBalance) {
    const row: Stored = { ...data, id: randomUUID(), userId, archivedAt: null };
    this.rows.push(row);
    if (opening)
      await this.balances.insert(userId, {
        accountId: row.id,
        amount: opening.amount,
        recordedAt: opening.recordedAt,
        origin: 'manual',
        transferId: null,
        note: null,
      });
    return this.withBalance(row);
  }
  async update(userId: string, id: string, patch: AccountPatch) {
    const row = this.mine(userId).find((r) => r.id === id);
    if (!row) return null;
    Object.assign(row, patch);
    return this.withBalance(row);
  }
  async setArchived(userId: string, id: string, archivedAt: string | null) {
    const row = this.mine(userId).find((r) => r.id === id);
    if (!row) return null;
    row.archivedAt = archivedAt;
    return this.withBalance(row);
  }
  async delete(userId: string, id: string) {
    const row = this.mine(userId).find((r) => r.id === id);
    if (!row) return 'not_found' as const;
    if ((this.transferCounts.get(id) ?? 0) > 0) return 'has_transfers' as const;
    this.rows = this.rows.filter((r) => r !== row);
    this.balances.dropAccount(id);
    return 'deleted' as const;
  }
  async reorder(userId: string, ids: string[]) {
    const mine = this.mine(userId);
    if (!ids.every((id) => mine.some((r) => r.id === id))) return false;
    ids.forEach((id, i) => {
      const row = mine.find((r) => r.id === id);
      if (row) row.sortOrder = i;
    });
    return true;
  }
  async countEntries(userId: string, id: string) {
    return (await this.balances.listByAccount(userId, id, Number.MAX_SAFE_INTEGER)).length;
  }
}
