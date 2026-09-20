import { err, ok, type Result } from 'neverthrow';
import type { Clock } from '@magermoney/domain';
import type { RateRepository } from './rate-repository.js';
import type { ProviderError, RateProvider } from './rate-provider.js';
import { fetchRates } from './fetch-rates.js';

/**
 * How long a set of rates counts as fresh. The endpoint behind this is open to
 * anyone signed in, and the providers we use are rate-limited free tiers, so a
 * screen that refreshes on a gesture must not be able to spend that budget: a
 * second pull inside the window is answered from what is already stored.
 */
export const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

export interface RefreshResult {
  /** Rows the providers added this time; 0 when nothing was fetched. */
  stored: number;
  /** False when the rates were already fresh — not an error, just nothing to do. */
  refreshed: boolean;
  /** When the rates on record were last written by a provider. */
  refreshedAt: string;
}

/**
 * Rates on demand, for every kind at once — the caller pulled a list down, not
 * "fiat". The cron job stays the normal path; this is the impatient one.
 */
export const refreshRates =
  (
    repo: RateRepository,
    providers: RateProvider[],
    clock: Clock,
    intervalMs: number = REFRESH_INTERVAL_MS,
  ) =>
  async (): Promise<Result<RefreshResult, ProviderError>> => {
    const last = await repo.lastApiRefreshAt();
    if (last && clock.now().getTime() - last.getTime() < intervalMs)
      return ok({ stored: 0, refreshed: false, refreshedAt: last.toISOString() });

    const fetch = fetchRates(repo, providers, clock);
    let stored = 0;
    for (const kind of ['fiat', 'crypto'] as const) {
      const res = await fetch(kind);
      if (res.isErr()) return err(res.error);
      stored += res.value.stored;
    }
    return ok({ stored, refreshed: true, refreshedAt: clock.now().toISOString() });
  };
