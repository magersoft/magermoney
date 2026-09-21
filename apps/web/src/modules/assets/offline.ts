/**
 * The assets module's second public entry, for the composition root and for
 * other modules' offline defaults: the query keys, with no screen behind them
 * (see `modules/accounts/offline.ts`).
 *
 * No mutation is registered here yet. Recording a valuation is the write with
 * the best claim to surviving a closed tab — it is made standing in front of
 * the thing — and it is the first one to wire when TASK-036 gives edits and
 * deletes a general home.
 */
export { ASSETS_KEY, valuationsKey } from './application/use-assets';
