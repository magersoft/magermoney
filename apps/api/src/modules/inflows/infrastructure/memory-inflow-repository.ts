import { randomUUID } from 'node:crypto';
import type { MemoryAccountRepository } from '../../accounts/infrastructure/memory-account-repository.js';
import type { MemoryIncomeSourceRepository } from '../../income-sources/infrastructure/memory-income-source-repository.js';
import {
  newestInflowFirst,
  parseInflowCursor,
  type InflowFilter,
  type InflowRepository,
  type InflowRow,
  type NewInflow,
} from '../application/inflow-repository.js';

export class MemoryInflowRepository implements InflowRepository {
  public rows: InflowRow[] = [];
  /** Stands in for the two `on delete restrict` foreign keys: sources and accounts ask how many inflows name them. */
  constructor(sources?: MemoryIncomeSourceRepository, accounts?: MemoryAccountRepository) {
    if (sources)
      sources.inflowCountOf = (id) => this.rows.filter((r) => r.incomeSourceId === id).length;
    if (accounts)
      accounts.inflowCountOf = (id) => this.rows.filter((r) => r.accountId === id).length;
  }
  private mine(userId: string) {
    return this.rows.filter((r) => r.userId === userId);
  }
  async list(userId: string, f: InflowFilter) {
    let rows = this.mine(userId)
      .filter((r) => f.from === undefined || r.receivedOn >= f.from)
      .filter((r) => f.to === undefined || r.receivedOn <= f.to)
      .filter((r) => f.sourceId === undefined || r.incomeSourceId === f.sourceId)
      .sort(newestInflowFirst);
    if (f.before) {
      const c = parseInflowCursor(f.before);
      const idx = rows.findIndex((r) => r.receivedOn === c.receivedOn && r.id === c.id);
      rows = idx >= 0 ? rows.slice(idx + 1) : rows.filter((r) => r.receivedOn < c.receivedOn);
    }
    return rows.slice(0, f.limit);
  }
  async findById(userId: string, id: string) {
    return this.mine(userId).find((r) => r.id === id) ?? null;
  }
  async insert(userId: string, data: NewInflow) {
    const row: InflowRow = { ...data, id: randomUUID(), userId };
    this.rows.push(row);
    return row;
  }
  async update(userId: string, id: string, data: NewInflow) {
    const row = await this.findById(userId, id);
    if (!row) return null;
    Object.assign(row, data);
    return row;
  }
  async delete(userId: string, id: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !(r.userId === userId && r.id === id));
    return this.rows.length < before;
  }
}
