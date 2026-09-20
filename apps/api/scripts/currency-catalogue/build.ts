import { CRYPTO } from './crypto.js';
import { ER_API_QUOTED, ISO_4217, SHIPPED_FIAT_SCALE } from './fiat.js';

/** One row of `public.currencies`, before it becomes SQL. */
export interface CatalogueRow {
  code: string;
  kind: 'fiat' | 'crypto';
  scale: number;
  /**
   * `null` for fiat on purpose: the client resolves a fiat symbol from ICU in
   * the reader's locale (`packages/ui` → `format-amount.ts`), and a symbol
   * stored here overrides that. Crypto has no ICU entry, so it stores its own.
   */
  symbol: string | null;
  nameRu: string;
  nameEn: string;
  /** `null` when no provider quotes this currency — see ADR 0006. */
  rateSource: 'open-er-api' | 'coingecko' | null;
  coingeckoId: string | null;
}

const capitalise = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/**
 * What ISO says a currency's minor unit is. Yen has none, the dinar has three,
 * and a catalogue that assumed two would round a third of a dinar away.
 */
function isoScale(code: string): number {
  return (
    SHIPPED_FIAT_SCALE[code] ??
    new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions()
      .maximumFractionDigits ??
    2
  );
}

/**
 * The currency's name in one language, or `null` when ICU has none. ICU returns
 * it lowercase in Russian ("колумбийский песо"); the list shows names as
 * labels, so the first letter is raised.
 */
function isoName(code: string, locale: 'ru' | 'en'): string | null {
  const name = new Intl.DisplayNames([locale], { type: 'currency', fallback: 'code' }).of(code);
  return name && name !== code ? capitalise(name) : null;
}

/**
 * The whole catalogue, as rows. Pure apart from ICU, which is why the
 * generator can be re-run and diffed rather than hand-maintained: the codes are
 * curated in `fiat.ts` and `crypto.ts`, everything else is derived.
 */
export function buildCatalogue(): CatalogueRow[] {
  const quoted = new Set(ER_API_QUOTED);

  const fiat: CatalogueRow[] = ISO_4217.map((code) => {
    /*
     * A currency ICU cannot name in one language falls back to the other rather
     * than to the bare code: "Bolívar Soberano" in a Russian list is imperfect,
     * but a person looking for the Venezuelan bolívar still recognises it,
     * where "VED" tells them nothing they did not already type.
     */
    const en = isoName(code, 'en');
    const ru = isoName(code, 'ru');
    return {
      code,
      kind: 'fiat',
      scale: isoScale(code),
      symbol: null,
      nameRu: ru ?? en ?? code,
      nameEn: en ?? ru ?? code,
      rateSource: quoted.has(code) ? 'open-er-api' : null,
      coingeckoId: null,
    };
  });

  const crypto: CatalogueRow[] = CRYPTO.map((c) => ({
    code: c.code,
    kind: 'crypto',
    scale: c.scale,
    symbol: c.symbol ?? null,
    nameRu: c.nameRu ?? c.nameEn,
    nameEn: c.nameEn,
    rateSource: 'coingecko',
    coingeckoId: c.coingeckoId,
  }));

  return [...fiat, ...crypto];
}
