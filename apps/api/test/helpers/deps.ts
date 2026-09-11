import { CurrencyRegistry, SystemClock, type Clock } from '@magermoney/domain';
import type { AppDeps } from '../../src/app.js';
import { MemoryProfileRepository } from '../../src/modules/profiles/infrastructure/memory-profile-repository.js';

export function testDeps(over: Partial<AppDeps> = {}): AppDeps {
  return {
    clock: new SystemClock() as Clock,
    jwtSecret: 'test-secret-test-secret-test-secret-1234',
    cronSecret: 'cron',
    profiles: new MemoryProfileRepository([]),
    registry: CurrencyRegistry.default(),
    ...over,
  } as AppDeps;
}
