import { SystemClock, type Clock } from '@magermoney/domain';
import type { AppDeps } from '../../src/app.js';

export function testDeps(over: Partial<AppDeps> = {}): AppDeps {
  return {
    clock: new SystemClock() as Clock,
    jwtSecret: 'test-secret-test-secret-test-secret-1234',
    cronSecret: 'cron',
    ...over,
  } as AppDeps;
}
