export type BalanceOrigin = 'manual' | 'transfer' | 'inflow';

export interface BalanceEntryRow {
  id: string;
  userId: string;
  accountId: string;
  amount: string;
  recordedAt: string; // ISO
  origin: BalanceOrigin;
  transferId: string | null;
  /** Set exactly when origin = 'inflow'. */
  inflowId: string | null;
  note: string | null;
  createdAt: string; // ISO
}
/** `inflowId` is optional on the way in, so manual and transfer writers need not mention it. */
export type NewBalanceEntry = Omit<BalanceEntryRow, 'id' | 'userId' | 'createdAt' | 'inflowId'> & {
  inflowId?: string | null;
};
export type BalanceEntryPatch = Partial<Pick<BalanceEntryRow, 'amount' | 'recordedAt' | 'note'>>;

export interface BalanceRepository {
  listByAccount(
    userId: string,
    accountId: string,
    limit: number,
    before?: string,
  ): Promise<BalanceEntryRow[]>;
  latest(userId: string, accountId: string): Promise<BalanceEntryRow | null>;
  findById(userId: string, id: string): Promise<BalanceEntryRow | null>;
  findByTransfer(userId: string, transferId: string): Promise<BalanceEntryRow[]>;
  /** A credited inflow has exactly one entry. */
  findByInflow(userId: string, inflowId: string): Promise<BalanceEntryRow | null>;
  insert(userId: string, data: NewBalanceEntry): Promise<BalanceEntryRow>;
  update(userId: string, id: string, patch: BalanceEntryPatch): Promise<BalanceEntryRow | null>;
  delete(userId: string, id: string): Promise<boolean>;
  deleteByTransfer(userId: string, transferId: string): Promise<number>;
  deleteByInflow(userId: string, inflowId: string): Promise<number>;
}

/** The cursor is the last row seen; rows strictly older come next. */
export const parseCursor = (before: string): { recordedAt: string; id: string } => {
  const [recordedAt, id] = before.split('|') as [string, string];
  return { recordedAt, id };
};

/** Newest first: recordedAt desc, then createdAt desc, then id desc as a final tiebreak. */
export const newestFirst = (a: BalanceEntryRow, b: BalanceEntryRow): number =>
  b.recordedAt.localeCompare(a.recordedAt) ||
  b.createdAt.localeCompare(a.createdAt) ||
  b.id.localeCompare(a.id);
