import type { CurrencyDto } from '@magermoney/contracts';
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
  deleteManual(userId: string, base: string, date: string): Promise<boolean>;
}
