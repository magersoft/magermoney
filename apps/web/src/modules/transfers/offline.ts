/**
 * The transfers module's second public entry, for the composition root only:
 * the keys and the mutation registration a restored offline write needs, with
 * no screen behind them (see `modules/accounts/offline.ts`).
 */
export { TRANSFERS_KEY } from './application/use-transfers';
export { registerTransferMutations, CREATE_TRANSFER_KEY } from './application/mutation-defaults';
