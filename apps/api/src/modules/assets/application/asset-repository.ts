import type { MarkColor } from '@magermoney/domain';

export interface AssetRow {
  id: string;
  userId: string;
  name: string;
  icon: string | null;
  /** A card-palette colour name; the check constraint holds the list. */
  color: MarkColor | null;
  currency: string;
  countsInTotal: boolean;
  acquiredOn: string | null; // YYYY-MM-DD
  purchasePrice: string | null;
  archivedAt: string | null; // ISO
  /** The latest valuation, joined from the journal. Never a column of its own (ADR 0002). */
  value: string | null;
  valuedOn: string | null; // YYYY-MM-DD
}

export type NewAsset = Omit<AssetRow, 'id' | 'userId' | 'archivedAt' | 'value' | 'valuedOn'>;
export type AssetPatch = Partial<NewAsset> & { archivedAt?: string | null };

export interface AssetRepository {
  /** Includes archived assets; ordered by name, then id. */
  list(userId: string): Promise<AssetRow[]>;
  findById(userId: string, id: string): Promise<AssetRow | null>;
  insert(userId: string, data: NewAsset): Promise<AssetRow>;
  update(userId: string, id: string, patch: AssetPatch): Promise<AssetRow | null>;
  /** Takes the asset's valuations with it. */
  delete(userId: string, id: string): Promise<boolean>;
}
