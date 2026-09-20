/**
 * The crypto half of the catalogue.
 *
 * Unlike fiat, none of this can come from ICU: `Intl` has never heard of a
 * coin, and CoinGecko prices by its own id rather than by ticker, so the id has
 * to be stored next to the code or the provider cannot ask for it. That is the
 * whole reason `currencies.coingecko_id` exists — see ADR 0006.
 *
 * Scope: the top of the market by capitalisation at generation time, minus
 * tokenised funds and exchange-internal instruments nobody tracks as savings.
 * The ten that shipped in the first catalogue keep their original scale, symbol
 * and names exactly — a person's existing balances are denominated in them.
 *
 * Names are Latin in both languages because that is how these coins are
 * written in Russian too; the two that are habitually transliterated
 * (Bitcoin, Ethereum) carry their Cyrillic form, as they already did.
 */
export interface CryptoEntry {
  code: string;
  coingeckoId: string;
  scale: number;
  nameEn: string;
  nameRu?: string;
  symbol?: string;
}

export const CRYPTO: readonly CryptoEntry[] = [
  // The original ten. Scale, symbol and names are frozen: accounts hold them.
  {
    code: 'BTC',
    coingeckoId: 'bitcoin',
    scale: 8,
    nameEn: 'Bitcoin',
    nameRu: 'Биткоин',
    symbol: '₿',
  },
  {
    code: 'ETH',
    coingeckoId: 'ethereum',
    scale: 8,
    nameEn: 'Ethereum',
    nameRu: 'Эфириум',
    symbol: 'Ξ',
  },
  { code: 'USDT', coingeckoId: 'tether', scale: 2, nameEn: 'Tether', symbol: '₮' },
  { code: 'XRP', coingeckoId: 'ripple', scale: 6, nameEn: 'XRP' },
  { code: 'SOL', coingeckoId: 'solana', scale: 6, nameEn: 'Solana' },
  { code: 'DOGE', coingeckoId: 'dogecoin', scale: 4, nameEn: 'Dogecoin' },
  { code: 'PEPE', coingeckoId: 'pepe', scale: 8, nameEn: 'Pepe' },
  { code: 'AVAX', coingeckoId: 'avalanche-2', scale: 6, nameEn: 'Avalanche' },
  { code: 'ATOM', coingeckoId: 'cosmos', scale: 6, nameEn: 'Cosmos' },
  { code: 'TRX', coingeckoId: 'tron', scale: 6, nameEn: 'Tron' },

  // Stablecoins. Two decimals: they are held as dollars, and eight would put
  // six meaningless zeros after every balance on the accounts screen.
  { code: 'USDC', coingeckoId: 'usd-coin', scale: 2, nameEn: 'USD Coin' },
  { code: 'DAI', coingeckoId: 'dai', scale: 2, nameEn: 'Dai' },
  { code: 'USDE', coingeckoId: 'ethena-usde', scale: 2, nameEn: 'Ethena USDe' },
  { code: 'PYUSD', coingeckoId: 'paypal-usd', scale: 2, nameEn: 'PayPal USD' },
  { code: 'RLUSD', coingeckoId: 'ripple-usd', scale: 2, nameEn: 'Ripple USD' },
  { code: 'USDD', coingeckoId: 'usdd', scale: 2, nameEn: 'USDD' },

  // Large caps.
  { code: 'BNB', coingeckoId: 'binancecoin', scale: 8, nameEn: 'BNB' },
  { code: 'ADA', coingeckoId: 'cardano', scale: 6, nameEn: 'Cardano' },
  { code: 'DOT', coingeckoId: 'polkadot', scale: 6, nameEn: 'Polkadot' },
  { code: 'LINK', coingeckoId: 'chainlink', scale: 6, nameEn: 'Chainlink' },
  { code: 'LTC', coingeckoId: 'litecoin', scale: 8, nameEn: 'Litecoin' },
  { code: 'BCH', coingeckoId: 'bitcoin-cash', scale: 8, nameEn: 'Bitcoin Cash' },
  { code: 'XLM', coingeckoId: 'stellar', scale: 6, nameEn: 'Stellar' },
  { code: 'XMR', coingeckoId: 'monero', scale: 8, nameEn: 'Monero' },
  { code: 'ZEC', coingeckoId: 'zcash', scale: 8, nameEn: 'Zcash' },
  { code: 'ETC', coingeckoId: 'ethereum-classic', scale: 8, nameEn: 'Ethereum Classic' },
  { code: 'TON', coingeckoId: 'the-open-network', scale: 6, nameEn: 'Toncoin' },
  { code: 'NEAR', coingeckoId: 'near', scale: 6, nameEn: 'NEAR Protocol' },
  { code: 'SUI', coingeckoId: 'sui', scale: 6, nameEn: 'Sui' },
  { code: 'APT', coingeckoId: 'aptos', scale: 6, nameEn: 'Aptos' },
  { code: 'HBAR', coingeckoId: 'hedera-hashgraph', scale: 6, nameEn: 'Hedera' },
  { code: 'ICP', coingeckoId: 'internet-computer', scale: 6, nameEn: 'Internet Computer' },
  { code: 'FIL', coingeckoId: 'filecoin', scale: 6, nameEn: 'Filecoin' },
  { code: 'ALGO', coingeckoId: 'algorand', scale: 6, nameEn: 'Algorand' },
  { code: 'VET', coingeckoId: 'vechain', scale: 6, nameEn: 'VeChain' },
  { code: 'XTZ', coingeckoId: 'tezos', scale: 6, nameEn: 'Tezos' },
  { code: 'IOTA', coingeckoId: 'iota', scale: 6, nameEn: 'IOTA' },
  { code: 'DASH', coingeckoId: 'dash', scale: 8, nameEn: 'Dash' },
  { code: 'EOS', coingeckoId: 'eos', scale: 6, nameEn: 'EOS' },
  { code: 'NEO', coingeckoId: 'neo', scale: 6, nameEn: 'Neo' },
  { code: 'KAS', coingeckoId: 'kaspa', scale: 8, nameEn: 'Kaspa' },
  { code: 'CRO', coingeckoId: 'crypto-com-chain', scale: 6, nameEn: 'Cronos' },
  { code: 'OKB', coingeckoId: 'okb', scale: 6, nameEn: 'OKB' },
  { code: 'LEO', coingeckoId: 'leo-token', scale: 6, nameEn: 'LEO Token' },
  // Mantle is left out: its ticker MNT is the Mongolian tugrik's ISO code, and
  // `currencies.code` is the primary key the whole app joins on.
  { code: 'HYPE', coingeckoId: 'hyperliquid', scale: 6, nameEn: 'Hyperliquid' },
  { code: 'TAO', coingeckoId: 'bittensor', scale: 8, nameEn: 'Bittensor' },

  // DeFi and L2.
  { code: 'UNI', coingeckoId: 'uniswap', scale: 6, nameEn: 'Uniswap' },
  { code: 'AAVE', coingeckoId: 'aave', scale: 6, nameEn: 'Aave' },
  { code: 'MKR', coingeckoId: 'maker', scale: 8, nameEn: 'Maker' },
  { code: 'CRV', coingeckoId: 'curve-dao-token', scale: 6, nameEn: 'Curve DAO' },
  { code: 'LDO', coingeckoId: 'lido-dao', scale: 6, nameEn: 'Lido DAO' },
  { code: 'GRT', coingeckoId: 'the-graph', scale: 6, nameEn: 'The Graph' },
  { code: 'INJ', coingeckoId: 'injective-protocol', scale: 6, nameEn: 'Injective' },
  { code: 'RUNE', coingeckoId: 'thorchain', scale: 6, nameEn: 'THORChain' },
  { code: 'ONDO', coingeckoId: 'ondo-finance', scale: 6, nameEn: 'Ondo' },
  { code: 'ENA', coingeckoId: 'ethena', scale: 6, nameEn: 'Ethena' },
  { code: 'ARB', coingeckoId: 'arbitrum', scale: 6, nameEn: 'Arbitrum' },
  { code: 'OP', coingeckoId: 'optimism', scale: 6, nameEn: 'Optimism' },
  { code: 'POL', coingeckoId: 'polygon-ecosystem-token', scale: 6, nameEn: 'Polygon' },
  { code: 'SEI', coingeckoId: 'sei-network', scale: 6, nameEn: 'Sei' },
  { code: 'STX', coingeckoId: 'stacks', scale: 6, nameEn: 'Stacks' },
  { code: 'IMX', coingeckoId: 'immutable-x', scale: 6, nameEn: 'Immutable' },
  { code: 'RENDER', coingeckoId: 'render-token', scale: 6, nameEn: 'Render' },
  { code: 'JUP', coingeckoId: 'jupiter-exchange-solana', scale: 6, nameEn: 'Jupiter' },
  { code: 'WLD', coingeckoId: 'worldcoin-wld', scale: 6, nameEn: 'Worldcoin' },
  { code: 'QNT', coingeckoId: 'quant-network', scale: 6, nameEn: 'Quant' },

  // Memes and gaming — small balances, so eight decimals where a unit is worth
  // a fraction of a cent.
  { code: 'SHIB', coingeckoId: 'shiba-inu', scale: 8, nameEn: 'Shiba Inu' },
  { code: 'BONK', coingeckoId: 'bonk', scale: 8, nameEn: 'Bonk' },
  { code: 'WIF', coingeckoId: 'dogwifcoin', scale: 6, nameEn: 'dogwifhat' },
  { code: 'FLOKI', coingeckoId: 'floki', scale: 8, nameEn: 'Floki' },
  { code: 'GALA', coingeckoId: 'gala', scale: 6, nameEn: 'Gala' },
  { code: 'AXS', coingeckoId: 'axie-infinity', scale: 6, nameEn: 'Axie Infinity' },
  { code: 'SAND', coingeckoId: 'the-sandbox', scale: 6, nameEn: 'The Sandbox' },
  { code: 'MANA', coingeckoId: 'decentraland', scale: 6, nameEn: 'Decentraland' },
  { code: 'CHZ', coingeckoId: 'chiliz', scale: 6, nameEn: 'Chiliz' },

  // Tokenised metal. Priced by CoinGecko like any other token, and people do
  // hold it, so it belongs here rather than among the ISO metal codes.
  { code: 'PAXG', coingeckoId: 'pax-gold', scale: 8, nameEn: 'PAX Gold' },
  { code: 'XAUT', coingeckoId: 'tether-gold', scale: 8, nameEn: 'Tether Gold' },
];
