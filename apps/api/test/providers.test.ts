import { describe, expect, it, vi } from 'vitest';
import { OpenErApiProvider } from '../src/modules/rates/infrastructure/open-er-api-provider.js';
import { CoinGeckoProvider } from '../src/modules/rates/infrastructure/coingecko-provider.js';

describe('providers', () => {
  it('open.er-api: inverts USD-based quotes into 1 base = x USD, exactly as strings', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ result: 'success', rates: { USD: 1, EUR: 0.862069, UZS: 11802.79 } })));
    const p = new OpenErApiProvider('https://x', fetcher);
    const out = (await p.fetch(['EUR', 'UZS', 'XXX']))._unsafeUnwrap();
    expect(out).toEqual([{ base: 'EUR', value: '1.159999954' }, { base: 'UZS', value: '0.0000847257301' }]);
  });
  it('open.er-api: fails on non-success', async () => {
    const p = new OpenErApiProvider('https://x', async () => new Response('{"result":"error"}', { status: 500 }));
    expect((await p.fetch(['EUR'])).isErr()).toBe(true);
  });
  it('coingecko: maps tickers to ids and back', async () => {
    const fetcher = vi.fn(async (url: string) => { expect(url).toContain('ids=bitcoin%2Ctether'); return new Response(JSON.stringify({ bitcoin: { usd: 77389.36 }, tether: { usd: 1.0004 } })); });
    const p = new CoinGeckoProvider('https://cg', fetcher);
    expect((await p.fetch(['BTC', 'USDT']))._unsafeUnwrap()).toEqual([{ base: 'BTC', value: '77389.36' }, { base: 'USDT', value: '1.0004' }]);
  });
});
