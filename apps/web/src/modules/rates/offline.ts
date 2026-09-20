/**
 * The rates module's second public entry, for anything that needs the query
 * keys without the screens behind them — `index.ts` re-exports the Rates page,
 * so importing the barrel for a key would drag it into the caller's chunk.
 *
 * Everything on screen that shows a converted amount — the home totals, the
 * accounts stack — reads its rates through `useRates`, so these keys are also
 * how a refresh reaches those screens.
 */
export { RATES_KEY, ratesKey } from './application/use-rates';
