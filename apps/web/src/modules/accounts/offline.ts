/**
 * The accounts module's second public entry, for the composition root only:
 * the keys and the mutation registration a restored offline write needs,
 * without a single screen behind them. `index.ts` re-exports every page, so
 * importing the barrel from `app/` would drag all of them into the entry chunk
 * and undo the router's lazy loading.
 */
export { ACCOUNTS_KEY, balancesKey } from './application/use-accounts';
export {
  registerAccountMutations,
  RECORD_BALANCE_KEY,
  type RecordBalanceVars,
} from './application/mutation-defaults';
