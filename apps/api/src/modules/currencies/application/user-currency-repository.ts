import type { CurrencyDto, CurrencyUsage } from '@magermoney/contracts';

export interface UserCurrencyRepository {
  /** The catalogue rows for what this person has connected, ordered as a list is read. */
  listConnected(userId: string): Promise<CurrencyDto[]>;
  /** The catalogue row for one code, or null when the catalogue has no such currency. */
  catalogueEntry(code: string): Promise<CurrencyDto | null>;
  /** Adds the currency. Idempotent: connecting twice is not an error, it is a no-op. */
  connect(userId: string, code: string): Promise<void>;
  disconnect(userId: string, code: string): Promise<void>;
  /**
   * Where this currency is still used by this person. Counted rather than
   * flagged so the refusal can say what to deal with first.
   */
  usage(userId: string, code: string): Promise<CurrencyUsage>;
}
