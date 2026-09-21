/**
 * The goals module's second public entry, for the composition root and for
 * other modules' offline defaults: the query keys, with no screen behind them
 * (see `modules/accounts/offline.ts`). `index.ts` re-exports every page, so an
 * import of the barrel from `app/` would undo the router's lazy loading.
 *
 * No mutation is registered here yet. Nothing a goal does is written in a lift:
 * a goal is created at a desk, and the one write that happens in the world —
 * an account's balance — already survives offline through the accounts module.
 * Parking edits and deletes generally is TASK-036's subject.
 */
export { GOALS_KEY } from './application/use-goals';
