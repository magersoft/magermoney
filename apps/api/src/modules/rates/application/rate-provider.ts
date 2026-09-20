import type { Result } from 'neverthrow';
export class ProviderError extends Error {
  readonly code = 'PROVIDER_FAILED';
  constructor(
    readonly provider: string,
    detail: string,
  ) {
    super(`${provider}: ${detail}`);
  }
}
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/** Which service quotes a currency. `null` in the catalogue means none does. */
export type RateSource = 'open-er-api' | 'coingecko';

/**
 * A currency to ask a provider about, as the catalogue holds it. `providerId`
 * is the provider's own name for it — CoinGecko prices `bitcoin`, not `BTC` —
 * and is null for a provider that speaks ISO codes.
 */
export interface QuotableCurrency {
  code: string;
  providerId: string | null;
}

export interface RateProvider {
  kind: 'fiat' | 'crypto';
  source: RateSource;
  fetch(
    currencies: QuotableCurrency[],
  ): Promise<Result<{ base: string; value: string }[], ProviderError>>;
}
