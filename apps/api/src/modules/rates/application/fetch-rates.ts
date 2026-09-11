import { err, ok, type Result } from 'neverthrow';
import type { Clock, CurrencyRegistry } from '@magermoney/domain';
import type { RateRepository } from './rate-repository.js';
import type { ProviderError, RateProvider } from './rate-provider.js';
export const fetchRates =
  (repo: RateRepository, providers: RateProvider[], registry: CurrencyRegistry, clock: Clock) =>
  async (kind: 'fiat' | 'crypto'): Promise<Result<{ stored: number }, ProviderError>> => {
    const codes = registry
      .all()
      .filter((c) => c.kind === kind)
      .map((c) => c.code);
    const today = clock.today();
    let stored = 0;
    for (const p of providers.filter((p) => p.kind === kind)) {
      const res = await p.fetch(codes);
      if (res.isErr()) return err(res.error);
      stored += await repo.upsertMany(
        res.value.map((r) => ({ ...r, date: today, source: 'api' as const, userId: null })),
      );
    }
    return ok({ stored });
  };
