import type { Sql } from '../../../shared/db/client.js';
import {
  parseInflowCursor,
  type InflowFilter,
  type InflowRepository,
  type InflowRow,
  type NewInflow,
} from '../application/inflow-repository.js';

/** `received_on` is a `date`: read it as text so no timezone can shift the day. */
const COLS = `id, user_id, income_source_id, amount::text as amount, currency,
  to_char(received_on, 'YYYY-MM-DD') as received_on, realised_rate_to_usd::text as realised_rate_to_usd,
  account_id, credited_amount::text as credited_amount, note`;

export class PgInflowRepository implements InflowRepository {
  constructor(private readonly sql: Sql) {}
  async list(userId: string, f: InflowFilter) {
    const c = f.before ? parseInflowCursor(f.before) : null;
    return this.sql<InflowRow[]>`
      select ${this.sql.unsafe(COLS)} from inflows
      where user_id = ${userId}
      ${f.from ? this.sql`and received_on >= ${f.from}::date` : this.sql``}
      ${f.to ? this.sql`and received_on <= ${f.to}::date` : this.sql``}
      ${f.sourceId ? this.sql`and income_source_id = ${f.sourceId}` : this.sql``}
      ${c ? this.sql`and (received_on, id) < (${c.receivedOn}::date, ${c.id}::uuid)` : this.sql``}
      order by received_on desc, id desc
      limit ${f.limit}`;
  }
  async findById(userId: string, id: string) {
    const [row] = await this.sql<InflowRow[]>`
      select ${this.sql.unsafe(COLS)} from inflows where user_id = ${userId} and id = ${id}`;
    return row ?? null;
  }
  async insert(userId: string, d: NewInflow) {
    const [row] = await this.sql<InflowRow[]>`
      insert into inflows
        (user_id, income_source_id, amount, currency, received_on, realised_rate_to_usd,
         account_id, credited_amount, note)
      values
        (${userId}, ${d.incomeSourceId}, ${d.amount}, ${d.currency}, ${d.receivedOn}, ${d.realisedRateToUsd},
         ${d.accountId}, ${d.creditedAmount}, ${d.note})
      returning ${this.sql.unsafe(COLS)}`;
    return row!;
  }
  async update(userId: string, id: string, d: NewInflow) {
    const [row] = await this.sql<InflowRow[]>`
      update inflows set
        income_source_id = ${d.incomeSourceId}, amount = ${d.amount}, currency = ${d.currency},
        received_on = ${d.receivedOn}, realised_rate_to_usd = ${d.realisedRateToUsd},
        account_id = ${d.accountId}, credited_amount = ${d.creditedAmount}, note = ${d.note}
      where user_id = ${userId} and id = ${id}
      returning ${this.sql.unsafe(COLS)}`;
    return row ?? null;
  }
  async delete(userId: string, id: string) {
    return (await this.sql`delete from inflows where user_id = ${userId} and id = ${id}`).count > 0;
  }
}
