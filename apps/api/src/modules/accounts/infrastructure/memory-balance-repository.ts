import { randomUUID } from 'node:crypto';
import {
  newestFirst,
  parseCursor,
  type BalanceEntryPatch,
  type BalanceEntryRow,
  type BalanceRepository,
  type NewBalanceEntry,
} from '../application/balance-repository.js';

export class MemoryBalanceRepository implements BalanceRepository {
  constructor(public rows: BalanceEntryRow[] = []) {}
  private mine(userId: string) {
    return this.rows.filter((r) => r.userId === userId);
  }
  async listByAccount(userId: string, accountId: string, limit: number, before?: string) {
    let rows = this.mine(userId)
      .filter((r) => r.accountId === accountId)
      .sort(newestFirst);
    if (before) {
      const c = parseCursor(before);
      const idx = rows.findIndex((r) => r.recordedAt === c.recordedAt && r.id === c.id);
      rows = idx >= 0 ? rows.slice(idx + 1) : rows.filter((r) => r.recordedAt < c.recordedAt);
    }
    return rows.slice(0, limit);
  }
  async latest(userId: string, accountId: string) {
    return (await this.listByAccount(userId, accountId, 1))[0] ?? null;
  }
  async findById(userId: string, id: string) {
    return this.mine(userId).find((r) => r.id === id) ?? null;
  }
  async findByTransfer(userId: string, transferId: string) {
    return this.mine(userId).filter((r) => r.transferId === transferId);
  }
  async findByInflow(userId: string, inflowId: string) {
    return this.mine(userId).find((r) => r.inflowId === inflowId) ?? null;
  }
  async insert(userId: string, data: NewBalanceEntry) {
    const row: BalanceEntryRow = {
      ...data,
      inflowId: data.inflowId ?? null,
      id: randomUUID(),
      userId,
      createdAt: new Date().toISOString(),
    };
    // Ties on createdAt are broken by insertion order in pg too; keep it deterministic here.
    const last = this.rows.at(-1);
    if (last && last.createdAt >= row.createdAt)
      row.createdAt = new Date(new Date(last.createdAt).getTime() + 1).toISOString();
    this.rows.push(row);
    return row;
  }
  async update(userId: string, id: string, patch: BalanceEntryPatch) {
    const row = await this.findById(userId, id);
    if (!row) return null;
    Object.assign(row, patch);
    return row;
  }
  async delete(userId: string, id: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !(r.userId === userId && r.id === id));
    return this.rows.length < before;
  }
  async deleteByTransfer(userId: string, transferId: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !(r.userId === userId && r.transferId === transferId));
    return before - this.rows.length;
  }
  async deleteByInflow(userId: string, inflowId: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !(r.userId === userId && r.inflowId === inflowId));
    return before - this.rows.length;
  }
  /** Test helper: drop every entry of an account (the pg cascade). */
  dropAccount(accountId: string) {
    this.rows = this.rows.filter((r) => r.accountId !== accountId);
  }
}
