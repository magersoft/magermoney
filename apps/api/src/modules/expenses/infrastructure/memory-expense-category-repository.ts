import { randomUUID } from 'node:crypto';
import type {
  ExpenseCategoryPatch,
  ExpenseCategoryRepository,
  ExpenseCategoryRow,
  NewExpenseCategory,
} from '../application/category-repository.js';
import type { ExpenseRepository } from '../application/expense-repository.js';

const key = (name: string) => name.trim().toLowerCase();

/** Takes the expenses repository so `delete` can refuse like the pg foreign key does. */
export class MemoryExpenseCategoryRepository implements ExpenseCategoryRepository {
  constructor(
    private readonly expenses: Pick<ExpenseRepository, 'countByCategory'>,
    public rows: ExpenseCategoryRow[] = [],
  ) {}
  private mine(userId: string) {
    return this.rows.filter((r) => r.userId === userId);
  }
  async list(userId: string) {
    return this.mine(userId).sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
  }
  async findById(userId: string, id: string) {
    return this.mine(userId).find((r) => r.id === id) ?? null;
  }
  async findByName(userId: string, name: string) {
    return this.mine(userId).find((r) => key(r.name) === key(name)) ?? null;
  }
  async insert(userId: string, data: NewExpenseCategory) {
    if (await this.findByName(userId, data.name)) return 'name_taken' as const;
    const row: ExpenseCategoryRow = { ...data, id: randomUUID(), userId };
    this.rows.push(row);
    return row;
  }
  async update(userId: string, id: string, patch: ExpenseCategoryPatch) {
    const row = await this.findById(userId, id);
    if (!row) return null;
    if (patch.name !== undefined) {
      const holder = await this.findByName(userId, patch.name);
      if (holder && holder.id !== id) return 'name_taken' as const;
    }
    Object.assign(row, patch);
    return row;
  }
  async delete(userId: string, id: string) {
    const row = await this.findById(userId, id);
    if (!row) return 'not_found' as const;
    if ((await this.expenses.countByCategory(userId, id)) > 0) return 'has_expenses' as const;
    this.rows = this.rows.filter((r) => r !== row);
    return 'deleted' as const;
  }
}
