import type { Repos } from '../../app.js';
import { PgProfileRepository } from '../../modules/profiles/infrastructure/pg-profile-repository.js';
import { PgUserCurrencyRepository } from '../../modules/currencies/infrastructure/pg-user-currency-repository.js';
import { PgAccountRepository } from '../../modules/accounts/infrastructure/pg-account-repository.js';
import { PgBalanceRepository } from '../../modules/accounts/infrastructure/pg-balance-repository.js';
import { PgTransferRepository } from '../../modules/transfers/infrastructure/pg-transfer-repository.js';
import { PgIncomeSourceRepository } from '../../modules/income-sources/infrastructure/pg-income-source-repository.js';
import { PgInflowRepository } from '../../modules/inflows/infrastructure/pg-inflow-repository.js';
import { PgExpenseCategoryRepository } from '../../modules/expenses/infrastructure/pg-expense-category-repository.js';
import { PgExpenseRepository } from '../../modules/expenses/infrastructure/pg-expense-repository.js';
import { PgBudgetRepository } from '../../modules/budgets/infrastructure/pg-budget-repository.js';
import { PgGoalRepository } from '../../modules/goals/infrastructure/pg-goal-repository.js';
import type { Sql } from './client.js';
import type { UnitOfWork } from './unit-of-work.js';

export const pgRepos = (sql: Sql): Repos => ({
  profiles: new PgProfileRepository(sql),
  userCurrencies: new PgUserCurrencyRepository(sql),
  accounts: new PgAccountRepository(sql),
  balances: new PgBalanceRepository(sql),
  transfers: new PgTransferRepository(sql),
  incomeSources: new PgIncomeSourceRepository(sql),
  inflows: new PgInflowRepository(sql),
  expenseCategories: new PgExpenseCategoryRepository(sql),
  expenses: new PgExpenseRepository(sql),
  budgets: new PgBudgetRepository(sql),
  goals: new PgGoalRepository(sql),
});

/** One transaction per unit of work; the repositories inside see the same connection, so `for update` locks hold until commit. */
export const pgUnitOfWork =
  (sql: Sql): UnitOfWork<Repos> =>
  (fn) =>
    sql.begin((tx) => fn(pgRepos(tx as unknown as Sql))) as ReturnType<typeof fn>;
