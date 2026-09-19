export interface ExpenseCategoryRow {
  id: string;
  userId: string;
  name: string;
  icon: string | null;
  sortOrder: number;
}
export type NewExpenseCategory = Omit<ExpenseCategoryRow, 'id' | 'userId'>;
export type ExpenseCategoryPatch = Partial<NewExpenseCategory>;

export interface ExpenseCategoryRepository {
  /** Ordered by sortOrder, then name. */
  list(userId: string): Promise<ExpenseCategoryRow[]>;
  findById(userId: string, id: string): Promise<ExpenseCategoryRow | null>;
  /** Case-insensitive, the name is compared trimmed. */
  findByName(userId: string, name: string): Promise<ExpenseCategoryRow | null>;
  /** `'name_taken'` when the user already has a category with this name in any case. */
  insert(userId: string, data: NewExpenseCategory): Promise<ExpenseCategoryRow | 'name_taken'>;
  update(
    userId: string,
    id: string,
    patch: ExpenseCategoryPatch,
  ): Promise<ExpenseCategoryRow | 'name_taken' | null>;
  delete(userId: string, id: string): Promise<'deleted' | 'not_found' | 'has_expenses'>;
}
