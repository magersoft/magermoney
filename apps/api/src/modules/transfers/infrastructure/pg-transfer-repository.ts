import type { Sql } from '../../../shared/db/client.js';
import type {
  NewTransfer,
  TransferPatch,
  TransferRepository,
  TransferRow,
} from '../application/transfer-repository.js';

type Raw = Omit<TransferRow, 'occurredAt'> & { occurredAt: Date };
const fromRaw = (r: Raw): TransferRow => ({ ...r, occurredAt: r.occurredAt.toISOString() });
const COLS =
  'id, user_id, from_account_id, to_account_id, amount_sent::text as amount_sent, amount_received::text as amount_received, occurred_at, note';

export class PgTransferRepository implements TransferRepository {
  constructor(private readonly sql: Sql) {}
  async list(userId: string, limit: number, before?: string, accountId?: string) {
    const [occurredAt, id] = before ? (before.split('|') as [string, string]) : [null, null];
    const rows = await this.sql<Raw[]>`
      select ${this.sql.unsafe(COLS)} from transfers
      where user_id = ${userId}
      ${accountId ? this.sql`and (from_account_id = ${accountId} or to_account_id = ${accountId})` : this.sql``}
      ${occurredAt ? this.sql`and (occurred_at, id) < (${occurredAt}::timestamptz, ${id}::uuid)` : this.sql``}
      order by occurred_at desc, id desc limit ${limit}`;
    return rows.map(fromRaw);
  }
  async findById(userId: string, id: string) {
    const [row] = await this.sql<
      Raw[]
    >`select ${this.sql.unsafe(COLS)} from transfers where user_id = ${userId} and id = ${id}`;
    return row ? fromRaw(row) : null;
  }
  async insert(userId: string, d: NewTransfer) {
    const [row] = await this.sql<Raw[]>`
      insert into transfers (user_id, from_account_id, to_account_id, amount_sent, amount_received, occurred_at, note)
      values (${userId}, ${d.fromAccountId}, ${d.toAccountId}, ${d.amountSent}, ${d.amountReceived}, ${d.occurredAt}, ${d.note})
      returning ${this.sql.unsafe(COLS)}`;
    return fromRaw(row!);
  }
  async update(userId: string, id: string, p: TransferPatch) {
    const data: Record<string, unknown> = {};
    if (p.amountSent !== undefined) data.amount_sent = p.amountSent;
    if (p.amountReceived !== undefined) data.amount_received = p.amountReceived;
    if (p.occurredAt !== undefined) data.occurred_at = p.occurredAt;
    if (p.note !== undefined) data.note = p.note;
    if (Object.keys(data).length === 0) return this.findById(userId, id);
    const [row] = await this.sql<
      Raw[]
    >`update transfers set ${this.sql(data)} where user_id = ${userId} and id = ${id} returning ${this.sql.unsafe(COLS)}`;
    return row ? fromRaw(row) : null;
  }
  async delete(userId: string, id: string) {
    return (
      (await this.sql`delete from transfers where user_id = ${userId} and id = ${id}`).count > 0
    );
  }
  async countByAccount(userId: string, accountId: string) {
    const [row] = await this.sql<
      { n: number }[]
    >`select count(*)::int as n from transfers where user_id = ${userId} and (from_account_id = ${accountId} or to_account_id = ${accountId})`;
    return row!.n;
  }
}
