import Decimal from 'decimal.js';
import { err, ok } from 'neverthrow';
import { ProviderError, type Fetcher, type RateProvider } from '../application/rate-provider.js';
export class OpenErApiProvider implements RateProvider {
  readonly kind = 'fiat' as const;
  constructor(
    private readonly url: string,
    private readonly fetcher: Fetcher = fetch,
  ) {}
  async fetch(codes: string[]) {
    try {
      const res = await this.fetcher(this.url);
      if (!res.ok) return err(new ProviderError('open.er-api', `HTTP ${res.status}`));
      const body = (await res.json()) as { result: string; rates?: Record<string, number> };
      if (body.result !== 'success' || !body.rates)
        return err(new ProviderError('open.er-api', 'result not success'));
      const out: { base: string; value: string }[] = [];
      for (const code of codes) {
        const perUsd = body.rates[code];
        if (typeof perUsd === 'number' && perUsd > 0 && code !== 'USD')
          out.push({
            base: code,
            value: new Decimal(1).div(perUsd).toSignificantDigits(10).toFixed(),
          });
      }
      return ok(out);
    } catch (e) {
      return err(new ProviderError('open.er-api', String(e)));
    }
  }
}
