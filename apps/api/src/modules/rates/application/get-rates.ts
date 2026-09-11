import type { RateDto } from '@magermoney/contracts';
import type { RateRepository, RateRow } from './rate-repository.js';
// Pick per base: newest date wins; on the same date a manual row (owned by the caller) beats api.
export const pickLatest = (rows: RateRow[]): RateDto[] => {
  const best = new Map<string, RateRow>();
  for (const r of rows) {
    const cur = best.get(r.base);
    if (
      !cur ||
      r.date > cur.date ||
      (r.date === cur.date && r.source === 'manual' && cur.source === 'api')
    )
      best.set(r.base, r);
  }
  return [...best.values()].map(({ base, quote, value, date, source }) => ({
    base,
    quote,
    value,
    date,
    source,
  }));
};
export const getRates =
  (repo: RateRepository) =>
  async (userId: string, date: string): Promise<RateDto[]> =>
    pickLatest(await repo.latestOnOrBefore(date, userId));
