import type { CurrencyDto } from '@magermoney/contracts';
import type { Sql } from '../../../shared/db/client.js';
import type { RateRepository, RateRow } from '../application/rate-repository.js';
export class PgRateRepository implements RateRepository {
  constructor(private readonly sql: Sql) {}
  async latestOnOrBefore(date: string, userId: string): Promise<RateRow[]> {
    return this.sql<RateRow[]>`
      select distinct on (base, source) base, quote, value::text as value, to_char(date, 'YYYY-MM-DD') as date, source, user_id
      from rates where date <= ${date} and (user_id is null or user_id = ${userId})
      order by base, source, date desc`;
  }
  async upsertMany(rows: Omit<RateRow, 'quote'>[]): Promise<number> {
    if (rows.length === 0) return 0;
    const res = await this.sql`
      insert into rates ${this.sql(rows.map((r) => ({ base: r.base, value: r.value, date: r.date, source: r.source, user_id: r.userId })))}
      on conflict (base, quote, date, source, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid)) do update set value = excluded.value`;
    return res.count;
  }
  async listCurrencies(): Promise<CurrencyDto[]> {
    return this.sql<CurrencyDto[]>`select code, kind, scale, symbol, name_ru, name_en, icon from currencies order by kind, code`;
  }
}
