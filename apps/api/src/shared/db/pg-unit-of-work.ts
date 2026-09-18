import type { Repos } from '../../app.js';
import { PgAccountRepository } from '../../modules/accounts/infrastructure/pg-account-repository.js';
import { PgBalanceRepository } from '../../modules/accounts/infrastructure/pg-balance-repository.js';
import { PgTransferRepository } from '../../modules/transfers/infrastructure/pg-transfer-repository.js';
import { PgIncomeSourceRepository } from '../../modules/income-sources/infrastructure/pg-income-source-repository.js';
import type { Sql } from './client.js';
import type { UnitOfWork } from './unit-of-work.js';

export const pgRepos = (sql: Sql): Repos => ({
  accounts: new PgAccountRepository(sql),
  balances: new PgBalanceRepository(sql),
  transfers: new PgTransferRepository(sql),
  incomeSources: new PgIncomeSourceRepository(sql),
});

/** One transaction per unit of work; the repositories inside see the same connection, so `for update` locks hold until commit. */
export const pgUnitOfWork =
  (sql: Sql): UnitOfWork<Repos> =>
  (fn) =>
    sql.begin((tx) => fn(pgRepos(tx as unknown as Sql))) as ReturnType<typeof fn>;
