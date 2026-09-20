/**
 * The profile module's second public entry, for the composition root only: the
 * key and the mutation registration a restored offline write needs, with no
 * screen behind them (see `modules/accounts/offline.ts`).
 */
export {
  PROFILE_KEY,
  registerProfileMutations,
  UPDATE_PROFILE_KEY,
  type UpdateProfileVars,
} from './application/mutation-defaults';
