import type { Sql } from '../../../shared/db/client.js';
import type {
  ExpensePatch,
  ExpenseRepository,
  ExpenseRow,
  NewExpense,
} from '../application/expense-repository.js';

/** `active_from` / `active_to` are `date`: read them as text so no timezone can shift the day. */
const COLS = `id, user_id, category_id, name, amount::text as amount, currency, period, billing_day, billing_month,
  is_essential, to_char(active_from, 'YYYY-MM-DD') as active_from, to_char(active_to, 'YYYY-MM-DD') as active_to`;

const toColumns = (p: ExpensePatch): Record<string, unknown> => {
  const d: Record<string, unknown> = {};
  if (p.categoryId !== undefined) d.category_id = p.categoryId;
  if (p.name !== undefined) d.name = p.name;
  if (p.amount !== undefined) d.amount = p.amount;
  if (p.currency !== undefined) d.currency = p.currency;
  if (p.period !== undefined) d.period = p.period;
  if (p.billingDay !== undefined) d.billing_day = p.billingDay;
  if (p.billingMonth !== undefined) d.billing_month = p.billingMonth;
  if (p.isEssential !== undefined) d.is_essential = p.isEssential;
  if (p.activeFrom !== undefined) d.active_from = p.activeFrom;
  if (p.activeTo !== undefined) d.active_to = p.activeTo;
  return d;
};

export class PgExpenseRepository implements ExpenseRepository {
  constructor(private readonly sql: Sql) {}
  async list(userId: string) {
    return this.sql<ExpenseRow[]>`
      select ${this.sql.unsafe(COLS)} from expenses where user_id = ${userId} order by lower(name), id`;
  }
  async findById(userId: string, id: string) {
    const [row] = await this.sql<ExpenseRow[]>`
      select ${this.sql.unsafe(COLS)} from expenses where user_id = ${userId} and id = ${id}`;
    return row ?? null;
  }
  async insert(userId: string, data: NewExpense) {
    const [row] = await this.sql<ExpenseRow[]>`
      insert into expenses ${this.sql({ user_id: userId, ...toColumns(data) })}
      returning ${this.sql.unsafe(COLS)}`;
    return row!;
  }
  async update(userId: string, id: string, patch: ExpensePatch) {
    const data = toColumns(patch);
    if (Object.keys(data).length === 0) return this.findById(userId, id);
    const [row] = await this.sql<ExpenseRow[]>`
      update expenses set ${this.sql(data)} where user_id = ${userId} and id = ${id}
      returning ${this.sql.unsafe(COLS)}`;
    return row ?? null;
  }
  async delete(userId: string, id: string) {
    return (
      (await this.sql`delete from expenses where user_id = ${userId} and id = ${id}`).count > 0
    );
  }
  async countByCategory(userId: string, categoryId: string) {
    const [{ count } = { count: 0 }] = await this.sql<{ count: number }[]>`
      select count(*)::int as count from expenses where user_id = ${userId} and category_id = ${categoryId}`;
    return count;
  }
}
