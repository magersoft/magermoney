import type { Sql } from '../../../shared/db/client.js';
import {
  parseCursor,
  type BalanceEntryPatch,
  type BalanceEntryRow,
  type BalanceRepository,
  type NewBalanceEntry,
} from '../application/balance-repository.js';

type Raw = Omit<BalanceEntryRow, 'recordedAt' | 'createdAt'> & {
  recordedAt: Date;
  createdAt: Date;
};
const iso = (d: Date) => d.toISOString();
const fromRaw = (r: Raw): BalanceEntryRow => ({
  ...r,
  recordedAt: iso(r.recordedAt),
  createdAt: iso(r.createdAt),
});
const COLS =
  'id, user_id, account_id, amount::text as amount, recorded_at, origin, transfer_id, note, created_at';

export class PgBalanceRepository implements BalanceRepository {
  constructor(private readonly sql: Sql) {}
  async listByAccount(userId: string, accountId: string, limit: number, before?: string) {
    const c = before ? parseCursor(before) : null;
    const rows = await this.sql<Raw[]>`
      select ${this.sql.unsafe(COLS)} from balance_entries
      where user_id = ${userId} and account_id = ${accountId}
      ${c ? this.sql`and (recorded_at, created_at, id) < (${c.recordedAt}::timestamptz, coalesce((select created_at from balance_entries where id = ${c.id} and user_id = ${userId}), 'infinity'::timestamptz), ${c.id}::uuid)` : this.sql``}
      order by recorded_at desc, created_at desc, id desc
      limit ${limit}`;
    return rows.map(fromRaw);
  }
  async latest(userId: string, accountId: string) {
    return (await this.listByAccount(userId, accountId, 1))[0] ?? null;
  }
  async findById(userId: string, id: string) {
    const [row] = await this.sql<
      Raw[]
    >`select ${this.sql.unsafe(COLS)} from balance_entries where user_id = ${userId} and id = ${id}`;
    return row ? fromRaw(row) : null;
  }
  async findByTransfer(userId: string, transferId: string) {
    const rows = await this.sql<
      Raw[]
    >`select ${this.sql.unsafe(COLS)} from balance_entries where user_id = ${userId} and transfer_id = ${transferId}`;
    return rows.map(fromRaw);
  }
  async insert(userId: string, data: NewBalanceEntry) {
    const [row] = await this.sql<Raw[]>`
      insert into balance_entries (user_id, account_id, amount, recorded_at, origin, transfer_id, note)
      values (${userId}, ${data.accountId}, ${data.amount}, ${data.recordedAt}, ${data.origin}, ${data.transferId}, ${data.note})
      returning ${this.sql.unsafe(COLS)}`;
    return fromRaw(row!);
  }
  async update(userId: string, id: string, patch: BalanceEntryPatch) {
    const data: Record<string, unknown> = {};
    if (patch.amount !== undefined) data.amount = patch.amount;
    if (patch.recordedAt !== undefined) data.recorded_at = patch.recordedAt;
    if (patch.note !== undefined) data.note = patch.note;
    if (Object.keys(data).length === 0) return this.findById(userId, id);
    const [row] = await this.sql<
      Raw[]
    >`update balance_entries set ${this.sql(data)} where user_id = ${userId} and id = ${id} returning ${this.sql.unsafe(COLS)}`;
    return row ? fromRaw(row) : null;
  }
  async delete(userId: string, id: string) {
    return (
      (await this.sql`delete from balance_entries where user_id = ${userId} and id = ${id}`).count >
      0
    );
  }
  async deleteByTransfer(userId: string, transferId: string) {
    return (
      await this
        .sql`delete from balance_entries where user_id = ${userId} and transfer_id = ${transferId}`
    ).count;
  }
}
