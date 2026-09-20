/**
 * Checks the catalogue that is actually committed, not one rebuilt here: names
 * and scales come from ICU, and the repo's runtimes ship different CLDR
 * vintages, so a test that regenerated the data would pass against a catalogue
 * nobody is going to ship.
 */
import { describe, expect, it } from 'vitest';
import type { CatalogueRow } from '../scripts/currency-catalogue/build.js';
import { CRYPTO } from '../scripts/currency-catalogue/crypto.js';
import { ISO_4217 } from '../scripts/currency-catalogue/fiat.js';
import catalogue from '../scripts/currency-catalogue/catalogue.json' with { type: 'json' };

const rows = catalogue as CatalogueRow[];
const byCode = new Map(rows.map((r) => [r.code, r]));

describe('currency catalogue', () => {
  it('has no duplicate codes', () => {
    const seen = new Set<string>();
    const dupes = rows.filter((r) => (seen.has(r.code) ? true : (seen.add(r.code), false)));
    expect(dupes.map((d) => d.code)).toEqual([]);
  });

  it('gives every currency a scale the money column can hold', () => {
    for (const r of rows) {
      expect(Number.isInteger(r.scale), `${r.code} scale ${r.scale}`).toBe(true);
      expect(r.scale, `${r.code} scale ${r.scale}`).toBeGreaterThanOrEqual(0);
      expect(r.scale, `${r.code} scale ${r.scale}`).toBeLessThanOrEqual(18);
    }
  });

  it('uses the scale ISO gives a currency, not a blanket two', () => {
    // A zero-decimal and a three-decimal currency, so a regression to `scale = 2`
    // everywhere fails here rather than in someone's yen balance.
    expect(byCode.get('JPY')?.scale).toBe(0);
    expect(byCode.get('BHD')?.scale).toBe(3);
    expect(byCode.get('USD')?.scale).toBe(2);
  });

  it('keeps the codes the first catalogue shipped, with their original scale', () => {
    const shipped = {
      USD: 2,
      EUR: 2,
      RUB: 2,
      KZT: 2,
      UZS: 2,
      IDR: 2,
      EGP: 2,
      GEL: 2,
      KGS: 2,
      BTC: 8,
      ETH: 8,
      USDT: 2,
      XRP: 6,
      SOL: 6,
      DOGE: 4,
      PEPE: 8,
      AVAX: 6,
      ATOM: 6,
      TRX: 6,
    };
    for (const [code, scale] of Object.entries(shipped)) {
      expect(byCode.get(code), `${code} is missing from the catalogue`).toBeDefined();
      expect(byCode.get(code)?.scale, `${code} scale`).toBe(scale);
    }
  });

  it('names every currency in both languages', () => {
    for (const r of rows) {
      expect(r.nameRu.length, `${r.code} nameRu`).toBeGreaterThan(0);
      expect(r.nameEn.length, `${r.code} nameEn`).toBeGreaterThan(0);
    }
  });

  it('translates fiat names, so a Russian search finds a Colombian peso', () => {
    expect(byCode.get('COP')?.nameRu).toMatch(/песо/i);
    expect(byCode.get('COP')?.nameEn).toMatch(/peso/i);
    expect(byCode.get('RUB')?.nameRu).toMatch(/рубль/i);
  });

  it('leaves fiat symbols to the client, which resolves them per locale', () => {
    for (const r of rows.filter((r) => r.kind === 'fiat')) expect(r.symbol, r.code).toBeNull();
  });

  it('carries a coingecko id for every crypto, and for nothing else', () => {
    for (const r of rows) {
      if (r.kind === 'crypto') expect(r.coingeckoId, r.code).toBeTruthy();
      else expect(r.coingeckoId, r.code).toBeNull();
    }
  });

  it('gives no two cryptocurrencies the same coingecko id', () => {
    const ids = rows.flatMap((r) => (r.coingeckoId ? [r.coingeckoId] : []));
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('pairs a rate source with the provider that can actually serve it', () => {
    for (const r of rows) {
      if (r.kind === 'crypto') expect(r.rateSource, r.code).toBe('coingecko');
      else expect([null, 'open-er-api'], r.code).toContain(r.rateSource);
    }
  });

  it('marks a currency no provider quotes as having no source, not a silent zero', () => {
    // North Korea's won: ISO 4217, and priced by nobody.
    expect(byCode.get('KPW')?.rateSource).toBeNull();
    expect(byCode.get('COP')?.rateSource).toBe('open-er-api');
  });

  it('covers every code the source lists', () => {
    expect(rows.filter((r) => r.kind === 'fiat').length).toBe(ISO_4217.length);
    expect(rows.filter((r) => r.kind === 'crypto').length).toBe(CRYPTO.length);
  });
});
