import { randomUUID } from 'node:crypto';
import type {
  AssetPatch,
  AssetRepository,
  AssetRow,
  NewAsset,
} from '../application/asset-repository.js';
import type { MemoryValuationRepository } from './memory-valuation-repository.js';

type Stored = Omit<AssetRow, 'value' | 'valuedOn'>;

export class MemoryAssetRepository implements AssetRepository {
  public rows: Stored[] = [];
  constructor(private readonly valuations: MemoryValuationRepository) {}

  /** The current value is the journal's last row, exactly as the pg lateral join reads it. */
  private withValue(row: Stored): AssetRow {
    const [latest] = this.valuations.rows
      .filter((v) => v.assetId === row.id)
      .sort((a, b) => b.valuedOn.localeCompare(a.valuedOn) || b.id.localeCompare(a.id));
    return { ...row, value: latest?.value ?? null, valuedOn: latest?.valuedOn ?? null };
  }
  private mine(userId: string) {
    return this.rows.filter((r) => r.userId === userId);
  }
  async list(userId: string) {
    return this.mine(userId)
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
      .map((r) => this.withValue(r));
  }
  async findById(userId: string, id: string) {
    const row = this.mine(userId).find((r) => r.id === id);
    return row ? this.withValue(row) : null;
  }
  async insert(userId: string, data: NewAsset) {
    const row: Stored = { ...data, id: randomUUID(), userId, archivedAt: null };
    this.rows.push(row);
    return this.withValue(row);
  }
  async update(userId: string, id: string, patch: AssetPatch) {
    const row = this.mine(userId).find((r) => r.id === id);
    if (!row) return null;
    Object.assign(row, patch);
    return this.withValue(row);
  }
  async delete(userId: string, id: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !(r.userId === userId && r.id === id));
    if (this.rows.length === before) return false;
    this.valuations.dropAsset(id);
    return true;
  }
}
