import type { ExpensePeriod } from '@magermoney/domain';

export interface ExpenseRow {
  id: string;
  userId: string;
  categoryId: string;
  name: string;
  amount: string;
  currency: string;
  period: ExpensePeriod;
  billingDay: number | null;
  billingMonth: number | null;
  isEssential: boolean;
  activeFrom: string; // YYYY-MM-DD
  activeTo: string | null; // YYYY-MM-DD
}
export type NewExpense = Omit<ExpenseRow, 'id' | 'userId'>;
export type ExpensePatch = Partial<NewExpense>;

export interface ExpenseRepository {
  /** Includes ended expenses; ordered by name, then id. */
  list(userId: string): Promise<ExpenseRow[]>;
  findById(userId: string, id: string): Promise<ExpenseRow | null>;
  insert(userId: string, data: NewExpense): Promise<ExpenseRow>;
  update(userId: string, id: string, patch: ExpensePatch): Promise<ExpenseRow | null>;
  delete(userId: string, id: string): Promise<boolean>;
  countByCategory(userId: string, categoryId: string): Promise<number>;
}
