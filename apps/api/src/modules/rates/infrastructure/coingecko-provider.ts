import Decimal from 'decimal.js';
import { err, ok } from 'neverthrow';
import { ProviderError, type Fetcher, type RateProvider } from '../application/rate-provider.js';
export const COINGECKO_IDS: Record<string, string> = { BTC: 'bitcoin', ETH: 'ethereum', USDT: 'tether', XRP: 'ripple', SOL: 'solana', DOGE: 'dogecoin', PEPE: 'pepe', AVAX: 'avalanche-2', ATOM: 'cosmos', TRX: 'tron' };
export class CoinGeckoProvider implements RateProvider {
  readonly kind = 'crypto' as const;
  constructor(private readonly url: string, private readonly fetcher: Fetcher = fetch) {}
  async fetch(codes: string[]) {
    const known = codes.filter((c) => COINGECKO_IDS[c]);
    if (known.length === 0) return ok([]);
    const ids = known.map((c) => COINGECKO_IDS[c]!).join(',');
    try {
      const res = await this.fetcher(`${this.url}?ids=${encodeURIComponent(ids)}&vs_currencies=usd&precision=full`);
      if (!res.ok) return err(new ProviderError('coingecko', `HTTP ${res.status}`));
      const body = (await res.json()) as Record<string, { usd?: number }>;
      return ok(known.flatMap((c) => { const v = body[COINGECKO_IDS[c]!]?.usd; return typeof v === 'number' && v > 0 ? [{ base: c, value: new Decimal(v).toFixed() }] : []; }));
    } catch (e) { return err(new ProviderError('coingecko', String(e))); }
  }
}
