import type { CurrencyDto } from '@magermoney/contracts';
import type { QuotableCurrency, RateSource } from './rate-provider.js';
export interface RateRow {
  base: string;
  quote: 'USD';
  value: string;
  date: string;
  source: 'api' | 'manual';
  userId: string | null;
}
export interface RateRepository {
  latestOnOrBefore(date: string, userId: string): Promise<RateRow[]>; // all candidate rows visible to userId with date <= date
  upsertMany(rows: Omit<RateRow, 'quote'>[]): Promise<number>;
  /** When a provider last wrote a rate, for anyone. `null` when none ever has. */
  lastApiRefreshAt(): Promise<Date | null>;
  listCurrencies(): Promise<CurrencyDto[]>;
  /**
   * The currencies this provider can be asked about, with the id it knows them
   * by. The catalogue decides, not a list compiled into the job (ADR 0006), so
   * a currency with no source is never asked for and never comes back a zero.
   */
  quotable(source: RateSource): Promise<QuotableCurrency[]>;
  deleteManual(userId: string, base: string, date: string): Promise<boolean>;
}
