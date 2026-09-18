export interface IncomeSourceRow {
  id: string;
  userId: string;
  name: string;
  /** Monthly gross, decimal string. */
  grossAmount: string;
  currency: string;
  /** Fractions in [0, 1), decimal strings. */
  taxRate: string;
  commissionRate: string;
  /** Days of the month, unique and ascending; empty = irregular source. */
  payDays: number[];
  isPrimary: boolean;
  activeFrom: string; // YYYY-MM-DD
  activeTo: string | null; // YYYY-MM-DD
  defaultAccountId: string | null;
}
export type NewIncomeSource = Omit<IncomeSourceRow, 'id' | 'userId'>;

export interface IncomeSourceRepository {
  /** Primary source first, then by name. */
  list(userId: string): Promise<IncomeSourceRow[]>;
  findById(userId: string, id: string): Promise<IncomeSourceRow | null>;
  insert(userId: string, data: NewIncomeSource): Promise<IncomeSourceRow>;
  /** Full-row update: the use case merges the patch, the repository writes every column. */
  update(userId: string, id: string, data: NewIncomeSource): Promise<IncomeSourceRow | null>;
  /**
   * Serialises every writer that moves the user's primary flag until the unit of work ends.
   * pg takes a transaction-scoped advisory lock (row locks cannot help a user with no rows yet,
   * and under READ COMMITTED a second `clearPrimary` does not see the row the first one just made
   * primary, so without this the loser trips the partial unique index and answers 500).
   */
  lockAll(userId: string): Promise<void>;
  /** Clears the primary flag on every source of the user; called before another one takes it. */
  clearPrimary(userId: string): Promise<void>;
  countInflows(userId: string, id: string): Promise<number>;
  delete(userId: string, id: string): Promise<'deleted' | 'not_found' | 'has_inflows'>;
}
