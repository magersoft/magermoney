export interface InflowRow {
  id: string;
  userId: string;
  incomeSourceId: string;
  amount: string;
  currency: string;
  receivedOn: string; // YYYY-MM-DD
  /** The USD rate actually obtained that day; null = use the rates table. */
  realisedRateToUsd: string | null;
  /** Set together: where the money landed and how much arrived, in the account's currency. */
  accountId: string | null;
  creditedAmount: string | null;
  note: string | null;
}
export type NewInflow = Omit<InflowRow, 'id' | 'userId'>;

export interface InflowFilter {
  from?: string | undefined;
  to?: string | undefined;
  sourceId?: string | undefined;
  limit: number;
  /** `${receivedOn}|${id}` of the last row seen; rows strictly older come next. */
  before?: string | undefined;
}

export interface InflowRepository {
  list(userId: string, filter: InflowFilter): Promise<InflowRow[]>;
  findById(userId: string, id: string): Promise<InflowRow | null>;
  insert(userId: string, data: NewInflow): Promise<InflowRow>;
  /** Full-row update: the use case merges the patch, the repository writes every column. */
  update(userId: string, id: string, data: NewInflow): Promise<InflowRow | null>;
  delete(userId: string, id: string): Promise<boolean>;
}

export const parseInflowCursor = (before: string): { receivedOn: string; id: string } => {
  const [receivedOn, id] = before.split('|') as [string, string];
  return { receivedOn, id };
};

/** Newest first: receivedOn desc, then id desc so the order is total. */
export const newestInflowFirst = (a: InflowRow, b: InflowRow): number =>
  b.receivedOn.localeCompare(a.receivedOn) || b.id.localeCompare(a.id);
