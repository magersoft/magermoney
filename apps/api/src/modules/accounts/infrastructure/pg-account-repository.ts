import type { Sql } from '../../../shared/db/client.js';
import type {
  AccountPatch,
  AccountRepository,
  AccountRow,
  NewAccount,
  OpeningBalance,
} from '../application/account-repository.js';

type Raw = Omit<AccountRow, 'archivedAt' | 'balanceRecordedAt'> & {
  archivedAt: Date | null;
  balanceRecordedAt: Date | null;
};
const fromRaw = (r: Raw): AccountRow => ({
  ...r,
  archivedAt: r.archivedAt?.toISOString() ?? null,
  balanceRecordedAt: r.balanceRecordedAt?.toISOString() ?? null,
});

/** `card_expires` is a `date`: read it as text so no timezone can shift the day. */
const SELECT = `
  select a.id, a.user_id, a.name, a.bank, a.country, a.currency, a.kind, a.card_type, a.is_spending,
         a.card_last4, a.card_network, a.card_tier, to_char(a.card_expires, 'YYYY-MM-DD') as card_expires,
         a.note, a.sort_order, a.archived_at,
         b.amount::text as balance, b.recorded_at as balance_recorded_at
  from accounts a
  left join lateral (
    select amount, recorded_at from balance_entries e
    where e.account_id = a.id and e.user_id = a.user_id
    order by e.recorded_at desc, e.created_at desc, e.id desc
    limit 1
  ) b on true`;

const toColumns = (p: AccountPatch): Record<string, unknown> => {
  const d: Record<string, unknown> = {};
  if (p.name !== undefined) d.name = p.name;
  if (p.bank !== undefined) d.bank = p.bank;
  if (p.country !== undefined) d.country = p.country;
  if (p.currency !== undefined) d.currency = p.currency;
  if (p.kind !== undefined) d.kind = p.kind;
  if (p.cardType !== undefined) d.card_type = p.cardType;
  if (p.isSpending !== undefined) d.is_spending = p.isSpending;
  if (p.cardLast4 !== undefined) d.card_last4 = p.cardLast4;
  if (p.cardNetwork !== undefined) d.card_network = p.cardNetwork;
  if (p.cardTier !== undefined) d.card_tier = p.cardTier;
  if (p.cardExpires !== undefined) d.card_expires = p.cardExpires;
  if (p.note !== undefined) d.note = p.note;
  if (p.sortOrder !== undefined) d.sort_order = p.sortOrder;
  return d;
};

export class PgAccountRepository implements AccountRepository {
  constructor(private readonly sql: Sql) {}
  async list(userId: string) {
    const rows = await this.sql<
      Raw[]
    >`${this.sql.unsafe(SELECT)} where a.user_id = ${userId} order by a.sort_order, a.name`;
    return rows.map(fromRaw);
  }
  async findById(userId: string, id: string) {
    const [row] = await this.sql<
      Raw[]
    >`${this.sql.unsafe(SELECT)} where a.user_id = ${userId} and a.id = ${id}`;
    return row ? fromRaw(row) : null;
  }
  async lock(userId: string, ids: string[]) {
    // Lock the account rows first (sorted, so two transfers over the same pair never deadlock), then read with balances.
    await this
      .sql`select id from accounts where user_id = ${userId} and id in ${this.sql(ids)} order by id for update`;
    const rows = await this.sql<
      Raw[]
    >`${this.sql.unsafe(SELECT)} where a.user_id = ${userId} and a.id in ${this.sql(ids)}`;
    return rows.map(fromRaw);
  }
  async create(userId: string, data: NewAccount, opening?: OpeningBalance) {
    const [created] = await this.sql<
      { id: string }[]
    >`insert into accounts ${this.sql({ ...toColumns(data), user_id: userId })} returning id`;
    if (opening)
      await this
        .sql`insert into balance_entries (user_id, account_id, amount, recorded_at, origin, note) values (${userId}, ${created!.id}, ${opening.amount}, ${opening.recordedAt}, 'manual', ${opening.note ?? null})`;
    return (await this.findById(userId, created!.id))!;
  }
  async update(userId: string, id: string, patch: AccountPatch) {
    const data = toColumns(patch);
    if (Object.keys(data).length > 0)
      await this
        .sql`update accounts set ${this.sql(data)} where user_id = ${userId} and id = ${id}`;
    return this.findById(userId, id);
  }
  async setArchived(userId: string, id: string, archivedAt: string | null) {
    await this
      .sql`update accounts set archived_at = ${archivedAt} where user_id = ${userId} and id = ${id}`;
    return this.findById(userId, id);
  }
  async delete(userId: string, id: string) {
    const [t] = await this.sql<
      { n: number }[]
    >`select count(*)::int as n from transfers where user_id = ${userId} and (from_account_id = ${id} or to_account_id = ${id})`;
    if (t!.n > 0) return 'has_transfers' as const;
    const res = await this.sql`delete from accounts where user_id = ${userId} and id = ${id}`;
    return res.count > 0 ? ('deleted' as const) : ('not_found' as const);
  }
  async reorder(userId: string, ids: string[]) {
    const [owned] = await this.sql<
      { n: number }[]
    >`select count(*)::int as n from accounts where user_id = ${userId} and id in ${this.sql(ids)}`;
    if (owned!.n !== ids.length) return false;
    await this.sql`
      update accounts a set sort_order = v.ord - 1
      from (select * from unnest(${this.sql.array(ids)}::uuid[]) with ordinality as t(id, ord)) v
      where a.id = v.id and a.user_id = ${userId}`;
    return true;
  }
  async countEntries(userId: string, id: string) {
    const [row] = await this.sql<
      { n: number }[]
    >`select count(*)::int as n from balance_entries where user_id = ${userId} and account_id = ${id}`;
    return row!.n;
  }
}
