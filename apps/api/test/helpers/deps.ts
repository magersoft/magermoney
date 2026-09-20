import {
  CurrencyRegistry,
  SAMPLE_CURRENCIES,
  SystemClock,
  type Clock,
  type Currency,
} from '@magermoney/domain';
import type { CurrencyDto } from '@magermoney/contracts';
import type { AppDeps } from '../../src/app.js';
import { MemoryProfileRepository } from '../../src/modules/profiles/infrastructure/memory-profile-repository.js';
import { MemoryRateRepository } from '../../src/modules/rates/infrastructure/memory-rate-repository.js';
import { MemoryUserCurrencyRepository } from '../../src/modules/currencies/infrastructure/memory-user-currency-repository.js';
import { memoryUnitOfWork } from '../../src/shared/db/unit-of-work.js';
import { MemoryAccountRepository } from '../../src/modules/accounts/infrastructure/memory-account-repository.js';
import { MemoryBalanceRepository } from '../../src/modules/accounts/infrastructure/memory-balance-repository.js';
import { MemoryTransferRepository } from '../../src/modules/transfers/infrastructure/memory-transfer-repository.js';
import { MemoryIncomeSourceRepository } from '../../src/modules/income-sources/infrastructure/memory-income-source-repository.js';
import { MemoryInflowRepository } from '../../src/modules/inflows/infrastructure/memory-inflow-repository.js';
import { MemoryExpenseCategoryRepository } from '../../src/modules/expenses/infrastructure/memory-expense-category-repository.js';
import { MemoryExpenseRepository } from '../../src/modules/expenses/infrastructure/memory-expense-repository.js';
import { MemoryBudgetRepository } from '../../src/modules/budgets/infrastructure/memory-budget-repository.js';

/** The sample set as the catalogue serves it, for the currency repositories. */
const toDto = (c: Currency): CurrencyDto => ({
  code: c.code,
  kind: c.kind,
  scale: c.scale,
  symbol: c.symbol ?? null,
  nameRu: null,
  nameEn: null,
  icon: null,
  rateSource: c.kind === 'crypto' ? 'coingecko' : 'open-er-api',
});

export function memoryRepos(
  profiles: MemoryProfileRepository = new MemoryProfileRepository([]),
  userCurrencies: MemoryUserCurrencyRepository = new MemoryUserCurrencyRepository(
    SAMPLE_CURRENCIES.map(toDto),
  ),
) {
  const balances = new MemoryBalanceRepository();
  const accounts = new MemoryAccountRepository(balances);
  const transfers = new MemoryTransferRepository(accounts);
  const incomeSources = new MemoryIncomeSourceRepository();
  const inflows = new MemoryInflowRepository(incomeSources, accounts);
  const expenses = new MemoryExpenseRepository();
  const expenseCategories = new MemoryExpenseCategoryRepository(expenses);
  return {
    profiles,
    userCurrencies,
    accounts,
    balances,
    transfers,
    incomeSources,
    inflows,
    expenseCategories,
    expenses,
    budgets: new MemoryBudgetRepository(),
  };
}

export function testDeps(over: Partial<AppDeps> = {}): AppDeps {
  // The unit of work must hand out the repositories the test actually inspects,
  // so it is built from the overridden ones when there are any.
  const profiles = (over.profiles as MemoryProfileRepository) ?? new MemoryProfileRepository([]);
  const userCurrencies =
    (over.userCurrencies as MemoryUserCurrencyRepository) ??
    new MemoryUserCurrencyRepository(SAMPLE_CURRENCIES.map(toDto));
  const repos = over.repos ?? memoryRepos(profiles, userCurrencies);
  return {
    clock: new SystemClock() as Clock,
    jwtSecret: 'test-secret-test-secret-test-secret-1234',
    cronSecret: 'cron',
    profiles,
    registry: CurrencyRegistry.sample(),
    rates: new MemoryRateRepository(),
    userCurrencies,
    rateProviders: [],
    ...over,
    repos,
    uow: over.uow ?? memoryUnitOfWork(repos),
  } as AppDeps;
}
