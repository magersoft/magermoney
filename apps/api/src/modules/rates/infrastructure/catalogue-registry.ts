import { CurrencyRegistry, type Currency, type CurrencyLookup } from '@magermoney/domain';
import type { RateRepository } from '../application/rate-repository.js';

/** How long a loaded catalogue is trusted. A currency arrives by migration, so rarely. */
const TTL_MS = 10 * 60 * 1000;

/**
 * The app's currency registry, read from `public.currencies` rather than from a
 * list compiled into the build (ADR 0006). Adding a currency is then a
 * migration, not a release.
 *
 * Every use case that validates a currency or reads its scale does so
 * synchronously, deep inside a `Result` chain, so this exposes the same
 * synchronous lookup and does its loading up front: `ready()` runs once per
 * cold start, before the first request is handled, and the snapshot it
 * produces answers every question until the TTL expires.
 *
 * It deliberately has no fallback list. A registry that quietly answered from
 * nineteen compiled-in currencies while the database was unreachable would
 * reject every account denominated in the other two hundred as an unknown
 * currency — a data error, for what is really an outage.
 */
export class CatalogueRegistry implements CurrencyLookup {
  private snapshot: CurrencyRegistry | undefined;
  private loadedAt = 0;
  private inFlight: Promise<void> | undefined;

  constructor(
    private readonly repo: RateRepository,
    private readonly now: () => number = Date.now,
  ) {}

  /** Loads the catalogue if it is missing or stale. Concurrent callers share one query. */
  async ready(): Promise<void> {
    if (this.snapshot && this.now() - this.loadedAt < TTL_MS) return;
    this.inFlight ??= this.load().finally(() => {
      this.inFlight = undefined;
    });
    await this.inFlight;
  }

  private async load(): Promise<void> {
    const rows = await this.repo.listCurrencies();
    const currencies: Currency[] = rows.map((r) =>
      r.symbol === null
        ? { code: r.code, kind: r.kind, scale: r.scale }
        : { code: r.code, kind: r.kind, scale: r.scale, symbol: r.symbol },
    );
    this.snapshot = new CurrencyRegistry(currencies);
    this.loadedAt = this.now();
  }

  private loaded(): CurrencyRegistry {
    if (!this.snapshot)
      throw new Error('Currency catalogue was read before it was loaded: call ready() first');
    return this.snapshot;
  }

  has(code: string) {
    return this.loaded().has(code);
  }
  get(code: string) {
    return this.loaded().get(code);
  }
  all() {
    return this.loaded().all();
  }
}
