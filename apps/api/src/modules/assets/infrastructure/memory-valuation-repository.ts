import { randomUUID } from 'node:crypto';
import type {
  NewValuation,
  ValuationPatch,
  ValuationRepository,
  ValuationRow,
} from '../application/valuation-repository.js';

export class MemoryValuationRepository implements ValuationRepository {
  constructor(public rows: ValuationRow[] = []) {}
  private mine(userId: string) {
    return this.rows.filter((r) => r.userId === userId);
  }
  private taken(assetId: string, valuedOn: string, except?: string) {
    return this.rows.some(
      (r) => r.assetId === assetId && r.valuedOn === valuedOn && r.id !== except,
    );
  }
  async list(userId: string, assetId: string) {
    return this.mine(userId)
      .filter((r) => r.assetId === assetId)
      .sort((a, b) => b.valuedOn.localeCompare(a.valuedOn) || b.id.localeCompare(a.id));
  }
  async findById(userId: string, id: string) {
    return this.mine(userId).find((r) => r.id === id) ?? null;
  }
  async insert(userId: string, data: NewValuation) {
    if (this.taken(data.assetId, data.valuedOn)) return null;
    const row: ValuationRow = { ...data, id: randomUUID(), userId };
    this.rows.push(row);
    return row;
  }
  async update(userId: string, id: string, patch: ValuationPatch) {
    const row = this.mine(userId).find((r) => r.id === id);
    if (!row) return null;
    if (patch.valuedOn !== undefined && this.taken(row.assetId, patch.valuedOn, id)) return null;
    Object.assign(row, patch);
    return row;
  }
  async delete(userId: string, id: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !(r.userId === userId && r.id === id));
    return this.rows.length < before;
  }
  /** The asset is gone, so its journal goes with it. */
  dropAsset(assetId: string) {
    this.rows = this.rows.filter((r) => r.assetId !== assetId);
  }
}
