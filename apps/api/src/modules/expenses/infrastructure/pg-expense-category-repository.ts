import type { Sql } from '../../../shared/db/client.js';
import type {
  ExpenseCategoryPatch,
  ExpenseCategoryRepository,
  ExpenseCategoryRow,
  NewExpenseCategory,
} from '../application/category-repository.js';

const COLS = 'id, user_id, name, icon, sort_order';
const isPgError = (e: unknown, code: string): boolean =>
  typeof e === 'object' && e !== null && (e as { code?: string }).code === code;

export class PgExpenseCategoryRepository implements ExpenseCategoryRepository {
  constructor(private readonly sql: Sql) {}
  async list(userId: string) {
    return this.sql<ExpenseCategoryRow[]>`
      select ${this.sql.unsafe(COLS)} from expense_categories
      where user_id = ${userId} order by sort_order, lower(name)`;
  }
  async findById(userId: string, id: string) {
    const [row] = await this.sql<ExpenseCategoryRow[]>`
      select ${this.sql.unsafe(COLS)} from expense_categories where user_id = ${userId} and id = ${id}`;
    return row ?? null;
  }
  async findByName(userId: string, name: string) {
    const [row] = await this.sql<ExpenseCategoryRow[]>`
      select ${this.sql.unsafe(COLS)} from expense_categories
      where user_id = ${userId} and lower(name) = lower(${name.trim()})`;
    return row ?? null;
  }
  async insert(userId: string, data: NewExpenseCategory) {
    // `on conflict do nothing` rather than catching 23505: a caught error would abort the surrounding transaction.
    const [row] = await this.sql<ExpenseCategoryRow[]>`
      insert into expense_categories (user_id, name, icon, sort_order)
      values (${userId}, ${data.name}, ${data.icon}, ${data.sortOrder})
      on conflict (user_id, lower(name)) do nothing
      returning ${this.sql.unsafe(COLS)}`;
    return row ?? ('name_taken' as const);
  }
  async update(userId: string, id: string, patch: ExpenseCategoryPatch) {
    const data: Record<string, unknown> = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.icon !== undefined) data.icon = patch.icon;
    if (patch.sortOrder !== undefined) data.sort_order = patch.sortOrder;
    if (Object.keys(data).length === 0) return this.findById(userId, id);
    if (patch.name !== undefined) {
      const holder = await this.findByName(userId, patch.name);
      if (holder && holder.id !== id) return 'name_taken' as const;
    }
    try {
      const [row] = await this.sql<ExpenseCategoryRow[]>`
        update expense_categories set ${this.sql(data)}
        where user_id = ${userId} and id = ${id} returning ${this.sql.unsafe(COLS)}`;
      return row ?? null;
    } catch (e) {
      // Two renames racing to the same name: the unique index is the last word.
      if (isPgError(e, '23505')) return 'name_taken' as const;
      throw e;
    }
  }
  async delete(userId: string, id: string) {
    const [{ count } = { count: 0 }] = await this.sql<{ count: number }[]>`
      select count(*)::int as count from expenses where user_id = ${userId} and category_id = ${id}`;
    if (count > 0) return 'has_expenses' as const;
    try {
      const res = await this
        .sql`delete from expense_categories where user_id = ${userId} and id = ${id}`;
      return res.count > 0 ? ('deleted' as const) : ('not_found' as const);
    } catch (e) {
      // An expense slipped in between the count and the delete; the foreign key (on delete restrict) caught it.
      if (isPgError(e, '23503')) return 'has_expenses' as const;
      throw e;
    }
  }
}
