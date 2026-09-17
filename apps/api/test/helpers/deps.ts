import { CurrencyRegistry, SystemClock, type Clock } from '@magermoney/domain';
import type { AppDeps } from '../../src/app.js';
import { MemoryProfileRepository } from '../../src/modules/profiles/infrastructure/memory-profile-repository.js';
import { MemoryRateRepository } from '../../src/modules/rates/infrastructure/memory-rate-repository.js';
import { memoryUnitOfWork } from '../../src/shared/db/unit-of-work.js';
import { MemoryAccountRepository } from '../../src/modules/accounts/infrastructure/memory-account-repository.js';
import { MemoryBalanceRepository } from '../../src/modules/accounts/infrastructure/memory-balance-repository.js';
import { MemoryTransferRepository } from '../../src/modules/transfers/infrastructure/memory-transfer-repository.js';

export function memoryRepos() {
  const balances = new MemoryBalanceRepository();
  const accounts = new MemoryAccountRepository(balances);
  const transfers = new MemoryTransferRepository(accounts);
  return { accounts, balances, transfers };
}

export function testDeps(over: Partial<AppDeps> = {}): AppDeps {
  // The unit of work must hand out the repositories the test actually inspects,
  // so it is built from the overridden ones when there are any.
  const repos = over.repos ?? memoryRepos();
  return {
    clock: new SystemClock() as Clock,
    jwtSecret: 'test-secret-test-secret-test-secret-1234',
    cronSecret: 'cron',
    profiles: new MemoryProfileRepository([]),
    registry: CurrencyRegistry.default(),
    rates: new MemoryRateRepository(),
    rateProviders: [],
    ...over,
    repos,
    uow: over.uow ?? memoryUnitOfWork(repos),
  } as AppDeps;
}
