export interface ValuationRow {
  id: string;
  userId: string;
  assetId: string;
  value: string;
  valuedOn: string; // YYYY-MM-DD
}

export type NewValuation = Omit<ValuationRow, 'id' | 'userId'>;
export type ValuationPatch = Partial<Omit<NewValuation, 'assetId'>>;

export interface ValuationRepository {
  /** One asset's journal, newest first. */
  list(userId: string, assetId: string): Promise<ValuationRow[]>;
  findById(userId: string, id: string): Promise<ValuationRow | null>;
  /** Null when the asset already has a valuation on that day — one opinion per day. */
  insert(userId: string, data: NewValuation): Promise<ValuationRow | null>;
  update(userId: string, id: string, patch: ValuationPatch): Promise<ValuationRow | null>;
  delete(userId: string, id: string): Promise<boolean>;
}
