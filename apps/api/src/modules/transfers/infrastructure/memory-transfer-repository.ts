import { randomUUID } from 'node:crypto';
import type { MemoryAccountRepository } from '../../accounts/infrastructure/memory-account-repository.js';
import type {
  NewTransfer,
  TransferPatch,
  TransferRepository,
  TransferRow,
} from '../application/transfer-repository.js';

export class MemoryTransferRepository implements TransferRepository {
  public rows: TransferRow[] = [];
  constructor(private readonly accounts?: MemoryAccountRepository) {}
  private mine(userId: string) {
    return this.rows.filter((r) => r.userId === userId);
  }
  private bump(row: TransferRow, delta: number) {
    if (!this.accounts) return;
    for (const id of [row.fromAccountId, row.toAccountId])
      this.accounts.transferCounts.set(id, (this.accounts.transferCounts.get(id) ?? 0) + delta);
  }
  async list(userId: string, limit: number, before?: string, accountId?: string) {
    let rows = this.mine(userId)
      .filter((r) => !accountId || r.fromAccountId === accountId || r.toAccountId === accountId)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id));
    if (before) {
      const [occurredAt, id] = before.split('|') as [string, string];
      const idx = rows.findIndex((r) => r.occurredAt === occurredAt && r.id === id);
      rows = idx >= 0 ? rows.slice(idx + 1) : rows.filter((r) => r.occurredAt < occurredAt);
    }
    return rows.slice(0, limit);
  }
  async findById(userId: string, id: string) {
    return this.mine(userId).find((r) => r.id === id) ?? null;
  }
  async insert(userId: string, data: NewTransfer) {
    const row: TransferRow = { ...data, id: randomUUID(), userId };
    this.rows.push(row);
    this.bump(row, 1);
    return row;
  }
  async update(userId: string, id: string, patch: TransferPatch) {
    const row = await this.findById(userId, id);
    if (!row) return null;
    Object.assign(row, patch);
    return row;
  }
  async delete(userId: string, id: string) {
    const row = await this.findById(userId, id);
    if (!row) return false;
    this.rows = this.rows.filter((r) => r !== row);
    this.bump(row, -1);
    return true;
  }
  async countByAccount(userId: string, accountId: string) {
    return this.mine(userId).filter(
      (r) => r.fromAccountId === accountId || r.toAccountId === accountId,
    ).length;
  }
}
