/**
 * The income module's second public entry, for the composition root only: the
 * keys and the mutation registration a restored offline write needs, with no
 * screen behind them (see `modules/accounts/offline.ts`).
 */
export { INCOME_SOURCES_KEY } from './application/use-income-sources';
export { INFLOWS_KEY, inflowsKey } from './application/use-inflows';
export {
  CREATE_INFLOW_KEY,
  registerIncomeMutations,
  type CreateInflowVars,
} from './application/mutation-defaults';
