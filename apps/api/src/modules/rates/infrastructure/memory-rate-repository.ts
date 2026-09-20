import type { CurrencyDto } from '@magermoney/contracts';
import { DEFAULT_CURRENCIES, SystemClock, type Clock } from '@magermoney/domain';
import type { RateRepository, RateRow } from '../application/rate-repository.js';
export class MemoryRateRepository implements RateRepository {
  /** Mirrors the `refreshed_at` column: when a provider last wrote here. */
  public lastApiRefresh: Date | null = null;
  constructor(
    public rows: RateRow[] = [],
    private readonly clock: Clock = new SystemClock(),
  ) {}
  async lastApiRefreshAt() {
    return this.lastApiRefresh;
  }
  async latestOnOrBefore(date: string, userId: string) {
    return this.rows.filter((r) => r.date <= date && (r.userId === null || r.userId === userId));
  }
  async upsertMany(rows: Omit<RateRow, 'quote'>[]) {
    if (rows.some((r) => r.source === 'api')) this.lastApiRefresh = this.clock.now();
    let n = 0;
    for (const r of rows) {
      const i = this.rows.findIndex(
        (x) =>
          x.base === r.base && x.date === r.date && x.source === r.source && x.userId === r.userId,
      );
      if (i >= 0) this.rows[i] = { ...r, quote: 'USD' };
      else {
        this.rows.push({ ...r, quote: 'USD' });
        n++;
      }
    }
    return n;
  }
  async listCurrencies(): Promise<CurrencyDto[]> {
    return DEFAULT_CURRENCIES.map((c) => ({
      code: c.code,
      kind: c.kind,
      scale: c.scale,
      symbol: c.symbol ?? null,
      nameRu: null,
      nameEn: null,
      icon: null,
    }));
  }
  async deleteManual(userId: string, base: string, date: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter(
      (r) => !(r.source === 'manual' && r.userId === userId && r.base === base && r.date === date),
    );
    return this.rows.length < before;
  }
}
