import type { CurrencyDto } from '@magermoney/contracts';
import { DEFAULT_CURRENCIES } from '@magermoney/domain';
import type { RateRepository, RateRow } from '../application/rate-repository.js';
export class MemoryRateRepository implements RateRepository {
  constructor(public rows: RateRow[] = []) {}
  async latestOnOrBefore(date: string, userId: string) {
    return this.rows.filter((r) => r.date <= date && (r.userId === null || r.userId === userId));
  }
  async upsertMany(rows: Omit<RateRow, 'quote'>[]) {
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
}
