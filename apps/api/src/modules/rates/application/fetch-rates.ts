import { err, ok, type Result } from 'neverthrow';
import type { Clock } from '@magermoney/domain';
import type { RateRepository } from './rate-repository.js';
import type { ProviderError, RateProvider } from './rate-provider.js';

/**
 * Asks every provider of one kind for the currencies the catalogue says it can
 * quote, and stores what comes back under today's date.
 *
 * The list comes from the repository rather than the registry: the registry
 * holds every currency the app knows, and most of them have no provider at all
 * (ADR 0006). Asking for those would spend the free tier's budget on codes the
 * provider will not answer for.
 */
export const fetchRates =
  (repo: RateRepository, providers: RateProvider[], clock: Clock) =>
  async (kind: 'fiat' | 'crypto'): Promise<Result<{ stored: number }, ProviderError>> => {
    const today = clock.today();
    let stored = 0;
    for (const p of providers.filter((p) => p.kind === kind)) {
      const currencies = await repo.quotable(p.source);
      if (currencies.length === 0) continue;
      const res = await p.fetch(currencies);
      if (res.isErr()) return err(res.error);
      stored += await repo.upsertMany(
        res.value.map((r) => ({ ...r, date: today, source: 'api' as const, userId: null })),
      );
    }
    return ok({ stored });
  };
