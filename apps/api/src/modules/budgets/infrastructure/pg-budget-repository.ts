import type { Sql } from '../../../shared/db/client.js';
import type {
  BudgetPatch,
  BudgetRepository,
  BudgetRow,
  NewBudget,
} from '../application/budget-repository.js';

/** `active_from` / `active_to` are `date`: read them as text so no timezone can shift the day. */
const COLS = `id, user_id, name, icon, monthly_limit::text as monthly_limit, currency,
  to_char(active_from, 'YYYY-MM-DD') as active_from, to_char(active_to, 'YYYY-MM-DD') as active_to`;

const toColumns = (p: BudgetPatch): Record<string, unknown> => {
  const d: Record<string, unknown> = {};
  if (p.name !== undefined) d.name = p.name;
  if (p.icon !== undefined) d.icon = p.icon;
  if (p.monthlyLimit !== undefined) d.monthly_limit = p.monthlyLimit;
  if (p.currency !== undefined) d.currency = p.currency;
  if (p.activeFrom !== undefined) d.active_from = p.activeFrom;
  if (p.activeTo !== undefined) d.active_to = p.activeTo;
  return d;
};

export class PgBudgetRepository implements BudgetRepository {
  constructor(private readonly sql: Sql) {}
  async list(userId: string) {
    return this.sql<BudgetRow[]>`
      select ${this.sql.unsafe(COLS)} from budgets where user_id = ${userId} order by lower(name), id`;
  }
  async findById(userId: string, id: string) {
    const [row] = await this.sql<BudgetRow[]>`
      select ${this.sql.unsafe(COLS)} from budgets where user_id = ${userId} and id = ${id}`;
    return row ?? null;
  }
  async insert(userId: string, data: NewBudget) {
    const [row] = await this.sql<BudgetRow[]>`
      insert into budgets ${this.sql({ user_id: userId, ...toColumns(data) })}
      returning ${this.sql.unsafe(COLS)}`;
    return row!;
  }
  async update(userId: string, id: string, patch: BudgetPatch) {
    const data = toColumns(patch);
    if (Object.keys(data).length === 0) return this.findById(userId, id);
    const [row] = await this.sql<BudgetRow[]>`
      update budgets set ${this.sql(data)} where user_id = ${userId} and id = ${id}
      returning ${this.sql.unsafe(COLS)}`;
    return row ?? null;
  }
  async delete(userId: string, id: string) {
    return (await this.sql`delete from budgets where user_id = ${userId} and id = ${id}`).count > 0;
  }
}
