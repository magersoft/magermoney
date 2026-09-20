import type { Clock } from '@magermoney/domain';
import type { RateRepository } from './rate-repository.js';
import type { RateProvider } from './rate-provider.js';

/**
 * Fetches today's rate for one currency, right now.
 *
 * The nightly job asks for everything anybody has connected; this asks for a
 * single code, because a currency connected at noon would otherwise show every
 * amount as unconvertible until the job next runs. The throttle that guards
 * `/rates/refresh` deliberately does not apply: this is one code, on an action
 * the person just took, not a list they can pull repeatedly.
 *
 * It throws rather than returning a `Result`: the caller connects the currency
 * either way, and a failure here is a log line, not an outcome.
 */
export const warmRate =
  (repo: RateRepository, providers: RateProvider[], clock: Clock) =>
  async (code: string): Promise<void> => {
    for (const p of providers) {
      const quotable = await repo.quotable(p.source);
      const one = quotable.find((c) => c.code === code);
      if (!one) continue;
      const res = await p.fetch([one]);
      if (res.isErr()) throw res.error;
      await repo.upsertMany(
        res.value.map((r) => ({
          ...r,
          date: clock.today(),
          source: 'api' as const,
          userId: null,
        })),
      );
      return;
    }
  };
