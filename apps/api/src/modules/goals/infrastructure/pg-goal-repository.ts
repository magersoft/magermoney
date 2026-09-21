import type { Sql } from '../../../shared/db/client.js';
import type {
  GoalPatch,
  GoalRepository,
  GoalRow,
  NewGoal,
} from '../application/goal-repository.js';

/** `target_date` is a `date`: read it as text so no timezone can shift the day. */
const COLS = `id, user_id, name, icon, target_amount::text as target_amount, currency,
  to_char(target_date, 'YYYY-MM-DD') as target_date, achieved_at, archived_at, sort_order`;

const toColumns = (p: GoalPatch): Record<string, unknown> => {
  const d: Record<string, unknown> = {};
  if (p.name !== undefined) d.name = p.name;
  if (p.icon !== undefined) d.icon = p.icon;
  if (p.targetAmount !== undefined) d.target_amount = p.targetAmount;
  if (p.currency !== undefined) d.currency = p.currency;
  if (p.targetDate !== undefined) d.target_date = p.targetDate;
  if (p.achievedAt !== undefined) d.achieved_at = p.achievedAt;
  if (p.archivedAt !== undefined) d.archived_at = p.archivedAt;
  if (p.sortOrder !== undefined) d.sort_order = p.sortOrder;
  return d;
};

type Raw = Omit<GoalRow, 'achievedAt' | 'archivedAt'> & {
  achievedAt: Date | null;
  archivedAt: Date | null;
};
const fromRaw = (r: Raw): GoalRow => ({
  ...r,
  achievedAt: r.achievedAt?.toISOString() ?? null,
  archivedAt: r.archivedAt?.toISOString() ?? null,
});

export class PgGoalRepository implements GoalRepository {
  constructor(private readonly sql: Sql) {}
  async list(userId: string) {
    const rows = await this.sql<Raw[]>`
      select ${this.sql.unsafe(COLS)} from goals where user_id = ${userId}
      order by sort_order, lower(name), id`;
    return rows.map(fromRaw);
  }
  async findById(userId: string, id: string) {
    const [row] = await this.sql<Raw[]>`
      select ${this.sql.unsafe(COLS)} from goals where user_id = ${userId} and id = ${id}`;
    return row ? fromRaw(row) : null;
  }
  async insert(userId: string, data: NewGoal) {
    const [row] = await this.sql<Raw[]>`
      insert into goals ${this.sql({ user_id: userId, ...toColumns(data) })}
      returning ${this.sql.unsafe(COLS)}`;
    return fromRaw(row!);
  }
  async update(userId: string, id: string, patch: GoalPatch) {
    const data = toColumns(patch);
    if (Object.keys(data).length === 0) return this.findById(userId, id);
    const [row] = await this.sql<Raw[]>`
      update goals set ${this.sql(data)} where user_id = ${userId} and id = ${id}
      returning ${this.sql.unsafe(COLS)}`;
    return row ? fromRaw(row) : null;
  }
  async delete(userId: string, id: string) {
    return (await this.sql`delete from goals where user_id = ${userId} and id = ${id}`).count > 0;
  }
}
