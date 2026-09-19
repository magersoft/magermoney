import { randomUUID } from 'node:crypto';
import type {
  IncomeSourceRepository,
  IncomeSourceRow,
  NewIncomeSource,
} from '../application/income-source-repository.js';

const primaryThenName = (a: IncomeSourceRow, b: IncomeSourceRow) =>
  Number(b.isPrimary) - Number(a.isPrimary) || a.name.localeCompare(b.name);

export class MemoryIncomeSourceRepository implements IncomeSourceRepository {
  public rows: IncomeSourceRow[] = [];
  /** How many inflows name a source; MemoryInflowRepository plugs itself in here. */
  public inflowCountOf: (sourceId: string) => number = () => 0;

  private mine(userId: string) {
    return this.rows.filter((r) => r.userId === userId);
  }
  async list(userId: string) {
    return [...this.mine(userId)].sort(primaryThenName);
  }
  async findById(userId: string, id: string) {
    return this.mine(userId).find((r) => r.id === id) ?? null;
  }
  async insert(userId: string, data: NewIncomeSource) {
    const row: IncomeSourceRow = { ...data, payDays: [...data.payDays], id: randomUUID(), userId };
    this.rows.push(row);
    return row;
  }
  async update(userId: string, id: string, data: NewIncomeSource) {
    const row = await this.findById(userId, id);
    if (!row) return null;
    Object.assign(row, data, { payDays: [...data.payDays] });
    return row;
  }
  async lockAll() {
    // One process, one thread: nothing to serialise.
  }
  async clearPrimary(userId: string) {
    for (const r of this.mine(userId)) r.isPrimary = false;
  }
  async countInflows(userId: string, id: string) {
    return (await this.findById(userId, id)) ? this.inflowCountOf(id) : 0;
  }
  async delete(userId: string, id: string) {
    const row = await this.findById(userId, id);
    if (!row) return 'not_found' as const;
    if (this.inflowCountOf(id) > 0) return 'has_inflows' as const;
    this.rows = this.rows.filter((r) => r !== row);
    return 'deleted' as const;
  }
}
