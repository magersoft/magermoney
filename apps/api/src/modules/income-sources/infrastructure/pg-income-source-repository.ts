import type { Sql } from '../../../shared/db/client.js';
import type {
  IncomeSourceRepository,
  IncomeSourceRow,
  NewIncomeSource,
} from '../application/income-source-repository.js';

/** `date` columns are read as text so no timezone can shift the day; numerics as text (ADR 0001). */
const COLS = `id, user_id, name, gross_amount::text as gross_amount, currency,
  tax_rate::text as tax_rate, commission_rate::text as commission_rate, pay_days, is_primary,
  to_char(active_from, 'YYYY-MM-DD') as active_from, to_char(active_to, 'YYYY-MM-DD') as active_to,
  default_account_id`;

/** An int[] literal: the driver cannot infer the element type of an empty array. */
const intArray = (xs: readonly number[]) => `{${xs.join(',')}}`;

export class PgIncomeSourceRepository implements IncomeSourceRepository {
  constructor(private readonly sql: Sql) {}
  async list(userId: string) {
    return this.sql<IncomeSourceRow[]>`
      select ${this.sql.unsafe(COLS)} from income_sources
      where user_id = ${userId} order by is_primary desc, name`;
  }
  async findById(userId: string, id: string) {
    const [row] = await this.sql<IncomeSourceRow[]>`
      select ${this.sql.unsafe(COLS)} from income_sources where user_id = ${userId} and id = ${id}`;
    return row ?? null;
  }
  async insert(userId: string, d: NewIncomeSource) {
    const [row] = await this.sql<IncomeSourceRow[]>`
      insert into income_sources
        (user_id, name, gross_amount, currency, tax_rate, commission_rate, pay_days, is_primary,
         active_from, active_to, default_account_id)
      values
        (${userId}, ${d.name}, ${d.grossAmount}, ${d.currency}, ${d.taxRate}, ${d.commissionRate},
         ${intArray(d.payDays)}::int[], ${d.isPrimary}, ${d.activeFrom}, ${d.activeTo}, ${d.defaultAccountId})
      returning ${this.sql.unsafe(COLS)}`;
    return row!;
  }
  async update(userId: string, id: string, d: NewIncomeSource) {
    const [row] = await this.sql<IncomeSourceRow[]>`
      update income_sources set
        name = ${d.name}, gross_amount = ${d.grossAmount}, currency = ${d.currency},
        tax_rate = ${d.taxRate}, commission_rate = ${d.commissionRate},
        pay_days = ${intArray(d.payDays)}::int[], is_primary = ${d.isPrimary},
        active_from = ${d.activeFrom}, active_to = ${d.activeTo},
        default_account_id = ${d.defaultAccountId}
      where user_id = ${userId} and id = ${id}
      returning ${this.sql.unsafe(COLS)}`;
    return row ?? null;
  }
  async lockAll(userId: string) {
    await this.sql`select pg_advisory_xact_lock(hashtext(${'income_sources:' + userId}))`;
  }
  async clearPrimary(userId: string) {
    await this
      .sql`update income_sources set is_primary = false where user_id = ${userId} and is_primary`;
  }
  async countInflows(userId: string, id: string) {
    const [row] = await this.sql<{ n: number }[]>`
      select count(*)::int as n from inflows where user_id = ${userId} and income_source_id = ${id}`;
    return row!.n;
  }
  async delete(userId: string, id: string) {
    // `for update` conflicts with the key-share lock an inserting inflow takes through its foreign key.
    const [locked] = await this.sql<{ id: string }[]>`
      select id from income_sources where user_id = ${userId} and id = ${id} for update`;
    if (!locked) return 'not_found' as const;
    if ((await this.countInflows(userId, id)) > 0) return 'has_inflows' as const;
    await this.sql`delete from income_sources where user_id = ${userId} and id = ${id}`;
    return 'deleted' as const;
  }
}
