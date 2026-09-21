import type { Sql } from '../../../shared/db/client.js';
import type {
  NewValuation,
  ValuationPatch,
  ValuationRepository,
  ValuationRow,
} from '../application/valuation-repository.js';

/** `valued_on` is a `date`: read it as text so no timezone can shift the day. */
const COLS = `id, user_id, asset_id, value::text as value,
  to_char(valued_on, 'YYYY-MM-DD') as valued_on`;

/** The `(asset_id, valued_on)` unique index — one opinion about a thing per day. */
const UNIQUE_VIOLATION = '23505';
const isDuplicate = (e: unknown): boolean =>
  typeof e === 'object' && e !== null && 'code' in e && e.code === UNIQUE_VIOLATION;

export class PgValuationRepository implements ValuationRepository {
  constructor(private readonly sql: Sql) {}
  async list(userId: string, assetId: string) {
    return this.sql<ValuationRow[]>`
      select ${this.sql.unsafe(COLS)} from asset_valuations
      where user_id = ${userId} and asset_id = ${assetId}
      order by valued_on desc, id desc`;
  }
  async findById(userId: string, id: string) {
    const [row] = await this.sql<ValuationRow[]>`
      select ${this.sql.unsafe(COLS)} from asset_valuations
      where user_id = ${userId} and id = ${id}`;
    return row ?? null;
  }
  async insert(userId: string, data: NewValuation) {
    try {
      const [row] = await this.sql<ValuationRow[]>`
        insert into asset_valuations ${this.sql({
          user_id: userId,
          asset_id: data.assetId,
          value: data.value,
          valued_on: data.valuedOn,
        })}
        returning ${this.sql.unsafe(COLS)}`;
      return row!;
    } catch (e) {
      if (isDuplicate(e)) return null;
      throw e;
    }
  }
  async update(userId: string, id: string, patch: ValuationPatch) {
    const d: Record<string, unknown> = {};
    if (patch.value !== undefined) d.value = patch.value;
    if (patch.valuedOn !== undefined) d.valued_on = patch.valuedOn;
    if (Object.keys(d).length === 0) return this.findById(userId, id);
    try {
      const [row] = await this.sql<ValuationRow[]>`
        update asset_valuations set ${this.sql(d)}
        where user_id = ${userId} and id = ${id}
        returning ${this.sql.unsafe(COLS)}`;
      return row ?? null;
    } catch (e) {
      if (isDuplicate(e)) return null;
      throw e;
    }
  }
  async delete(userId: string, id: string) {
    return (
      (await this.sql`delete from asset_valuations where user_id = ${userId} and id = ${id}`)
        .count > 0
    );
  }
}
