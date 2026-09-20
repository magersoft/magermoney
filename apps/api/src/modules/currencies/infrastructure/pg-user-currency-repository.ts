import type { CurrencyDto, CurrencyUsage } from '@magermoney/contracts';
import type { Sql } from '../../../shared/db/client.js';
import type { UserCurrencyRepository } from '../application/user-currency-repository.js';

const COLUMNS = 'c.code, c.kind, c.scale, c.symbol, c.name_ru, c.name_en, c.icon, c.rate_source';

export class PgUserCurrencyRepository implements UserCurrencyRepository {
  constructor(private readonly sql: Sql) {}

  async listConnected(userId: string): Promise<CurrencyDto[]> {
    return this.sql<CurrencyDto[]>`
      select ${this.sql.unsafe(COLUMNS)}
      from user_currencies uc join currencies c on c.code = uc.code
      where uc.user_id = ${userId}
      order by c.kind, c.code`;
  }

  async catalogueEntry(code: string): Promise<CurrencyDto | null> {
    const [row] = await this.sql<CurrencyDto[]>`
      select ${this.sql.unsafe(COLUMNS)} from currencies c where c.code = ${code}`;
    return row ?? null;
  }

  async connect(userId: string, code: string): Promise<void> {
    await this.sql`
      insert into user_currencies (user_id, code) values (${userId}, ${code})
      on conflict do nothing`;
  }

  async disconnect(userId: string, code: string): Promise<void> {
    await this.sql`delete from user_currencies where user_id = ${userId} and code = ${code}`;
  }

  /*
   * One round trip rather than six: the refusal has to name every place at
   * once, so asking table by table would only pay latency to learn the same
   * thing more slowly.
   */
  async usage(userId: string, code: string): Promise<CurrencyUsage> {
    const [row] = await this.sql<
      {
        accounts: number;
        budgets: number;
        expenses: number;
        incomeSources: number;
        inflows: number;
        profile: boolean;
      }[]
    >`
      select
        (select count(*) from accounts where user_id = ${userId} and currency = ${code})::int as accounts,
        (select count(*) from budgets where user_id = ${userId} and currency = ${code})::int as budgets,
        (select count(*) from expenses where user_id = ${userId} and currency = ${code})::int as expenses,
        (select count(*) from income_sources where user_id = ${userId} and currency = ${code})::int as income_sources,
        (select count(*) from inflows where user_id = ${userId} and currency = ${code})::int as inflows,
        (select default_currency = ${code} or ${code} = any(reporting_currencies)
           from profiles where id = ${userId}) as profile`;
    return (
      row ?? {
        accounts: 0,
        budgets: 0,
        expenses: 0,
        incomeSources: 0,
        inflows: 0,
        profile: false,
      }
    );
  }
}
