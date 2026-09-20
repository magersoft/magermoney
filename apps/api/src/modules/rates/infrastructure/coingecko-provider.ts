import Decimal from 'decimal.js';
import { err, ok } from 'neverthrow';
import {
  ProviderError,
  type Fetcher,
  type QuotableCurrency,
  type RateProvider,
} from '../application/rate-provider.js';

/**
 * CoinGecko prices by its own id — `bitcoin`, not `BTC` — so the id travels
 * with the currency from `currencies.coingecko_id` (ADR 0006). A coin the
 * catalogue has no id for is simply not asked about: this provider holds no
 * list of its own, so adding a coin is a migration rather than a release.
 */
export class CoinGeckoProvider implements RateProvider {
  readonly kind = 'crypto' as const;
  readonly source = 'coingecko' as const;
  constructor(
    private readonly url: string,
    private readonly fetcher: Fetcher = fetch,
  ) {}
  async fetch(currencies: QuotableCurrency[]) {
    const known = currencies.filter(
      (c): c is { code: string; providerId: string } => c.providerId !== null,
    );
    if (known.length === 0) return ok([]);
    const ids = known.map((c) => c.providerId).join(',');
    try {
      const res = await this.fetcher(
        `${this.url}?ids=${encodeURIComponent(ids)}&vs_currencies=usd&precision=full`,
      );
      if (!res.ok) return err(new ProviderError('coingecko', `HTTP ${res.status}`));
      const body = (await res.json()) as Record<string, { usd?: number }>;
      return ok(
        known.flatMap((c) => {
          const v = body[c.providerId]?.usd;
          return typeof v === 'number' && v > 0
            ? [{ base: c.code, value: new Decimal(v).toFixed() }]
            : [];
        }),
      );
    } catch (e) {
      return err(new ProviderError('coingecko', String(e)));
    }
  }
}
