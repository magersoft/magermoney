import type { AccountKind, CardType } from '@magermoney/domain';

export interface AccountRow {
  id: string;
  userId: string;
  name: string;
  bank: string;
  country: string;
  currency: string;
  kind: AccountKind;
  cardType: CardType | null;
  isSpending: boolean;
  cardLast4: string | null;
  cardNetwork: string | null;
  cardTier: string | null;
  cardExpires: string | null; // YYYY-MM-DD
  note: string | null;
  sortOrder: number;
  archivedAt: string | null; // ISO
  /** Latest balance entry, joined. */
  balance: string | null;
  balanceRecordedAt: string | null;
}

export type NewAccount = Omit<
  AccountRow,
  'id' | 'userId' | 'archivedAt' | 'balance' | 'balanceRecordedAt'
>;
export type AccountPatch = Partial<NewAccount>;
export interface OpeningBalance {
  amount: string;
  recordedAt: string;
  note?: string | null;
}

export interface AccountRepository {
  list(userId: string): Promise<AccountRow[]>;
  findById(userId: string, id: string): Promise<AccountRow | null>;
  /** Row locks for the duration of the unit of work (`for update` in pg). Returns the rows found. */
  lock(userId: string, ids: string[]): Promise<AccountRow[]>;
  create(userId: string, data: NewAccount, opening?: OpeningBalance): Promise<AccountRow>;
  update(userId: string, id: string, patch: AccountPatch): Promise<AccountRow | null>;
  setArchived(userId: string, id: string, archivedAt: string | null): Promise<AccountRow | null>;
  delete(userId: string, id: string): Promise<'deleted' | 'not_found' | 'has_transfers'>;
  /** Assigns sort_order 0..n-1 in the given order. False if any id is not the user's. */
  reorder(userId: string, ids: string[]): Promise<boolean>;
  countEntries(userId: string, id: string): Promise<number>;
}
