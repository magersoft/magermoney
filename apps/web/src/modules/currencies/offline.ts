/**
 * The currencies module's second public entry: the query keys, without the
 * composables behind them. Anything that needs to invalidate a currency cache
 * imports this rather than the barrel.
 */
export { CATALOGUE_KEY, CURRENCIES_KEY } from './application/query-keys';
