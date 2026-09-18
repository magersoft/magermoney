export interface BudgetRow {
  id: string;
  userId: string;
  name: string;
  icon: string | null;
  monthlyLimit: string;
  currency: string;
  activeFrom: string; // YYYY-MM-DD
  activeTo: string | null; // YYYY-MM-DD
}
export type NewBudget = Omit<BudgetRow, 'id' | 'userId'>;
export type BudgetPatch = Partial<NewBudget>;

export interface BudgetRepository {
  /** Includes ended budgets; ordered by name, then id. */
  list(userId: string): Promise<BudgetRow[]>;
  findById(userId: string, id: string): Promise<BudgetRow | null>;
  insert(userId: string, data: NewBudget): Promise<BudgetRow>;
  update(userId: string, id: string, patch: BudgetPatch): Promise<BudgetRow | null>;
  delete(userId: string, id: string): Promise<boolean>;
}
