import type { Sql } from '../../../shared/db/client.js';
import type {
  AssetPatch,
  AssetRepository,
  AssetRow,
  NewAsset,
} from '../application/asset-repository.js';

/**
 * `value` and `valued_on` come from the journal's last row, never from a column
 * beside it (ADR 0002). `acquired_on` is a `date`: read as text so no timezone
 * can shift the day.
 */
const SELECT = `
  select a.id, a.user_id, a.name, a.currency, a.counts_in_total,
         to_char(a.acquired_on, 'YYYY-MM-DD') as acquired_on,
         a.purchase_price::text as purchase_price, a.archived_at,
         latest.value, latest.valued_on
  from assets a
  left join lateral (
    select v.value::text as value, to_char(v.valued_on, 'YYYY-MM-DD') as valued_on
    from asset_valuations v
    where v.asset_id = a.id and v.user_id = a.user_id
    order by v.valued_on desc, v.id desc
    limit 1
  ) latest on true`;

const toColumns = (p: AssetPatch): Record<string, unknown> => {
  const d: Record<string, unknown> = {};
  if (p.name !== undefined) d.name = p.name;
  if (p.currency !== undefined) d.currency = p.currency;
  if (p.countsInTotal !== undefined) d.counts_in_total = p.countsInTotal;
  if (p.acquiredOn !== undefined) d.acquired_on = p.acquiredOn;
  if (p.purchasePrice !== undefined) d.purchase_price = p.purchasePrice;
  if (p.archivedAt !== undefined) d.archived_at = p.archivedAt;
  return d;
};

type Raw = Omit<AssetRow, 'archivedAt'> & { archivedAt: Date | null };
const fromRaw = (r: Raw): AssetRow => ({ ...r, archivedAt: r.archivedAt?.toISOString() ?? null });

export class PgAssetRepository implements AssetRepository {
  constructor(private readonly sql: Sql) {}
  async list(userId: string) {
    const rows = await this.sql<
      Raw[]
    >`${this.sql.unsafe(SELECT)} where a.user_id = ${userId} order by lower(a.name), a.id`;
    return rows.map(fromRaw);
  }
  async findById(userId: string, id: string) {
    const [row] = await this.sql<
      Raw[]
    >`${this.sql.unsafe(SELECT)} where a.user_id = ${userId} and a.id = ${id}`;
    return row ? fromRaw(row) : null;
  }
  async insert(userId: string, data: NewAsset) {
    const [created] = await this.sql<
      { id: string }[]
    >`insert into assets ${this.sql({ user_id: userId, ...toColumns(data) })} returning id`;
    return (await this.findById(userId, created!.id))!;
  }
  async update(userId: string, id: string, patch: AssetPatch) {
    const data = toColumns(patch);
    if (Object.keys(data).length > 0)
      await this.sql`update assets set ${this.sql(data)} where user_id = ${userId} and id = ${id}`;
    return this.findById(userId, id);
  }
  async delete(userId: string, id: string) {
    // `asset_valuations.asset_id` cascades, so the journal goes with it.
    return (await this.sql`delete from assets where user_id = ${userId} and id = ${id}`).count > 0;
  }
}
