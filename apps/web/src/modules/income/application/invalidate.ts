import type { QueryClient } from '@tanstack/vue-query';
import { ACCOUNTS_KEY, balancesKey } from '@/modules/accounts/offline';
import { INFLOWS_KEY } from './use-inflows';

/**
 * An inflow that credits an Account writes a Balance entry, so changing it
 * changes that Account's balance and journal too. `accountIds` names the
 * Accounts involved — the one it was on and the one it moves to.
 *
 * The keys come from `@/modules/accounts/offline`, not the accounts barrel:
 * this file is reached from `income/offline.ts`, which the composition root
 * loads statically, and the barrel would drag every accounts screen into the
 * entry chunk. (Phase 2's `transfers/mutation-defaults.ts` imports the barrel;
 * the ledger lists that as a follow-up — follow the rule, not the precedent.)
 */
export const invalidateAfterInflow = (
  qc: QueryClient,
  accountIds: readonly string[],
): Promise<unknown> =>
  Promise.all([
    qc.invalidateQueries({ queryKey: INFLOWS_KEY }),
    ...(accountIds.length > 0 ? [qc.invalidateQueries({ queryKey: ACCOUNTS_KEY })] : []),
    ...accountIds.map((id) => qc.invalidateQueries({ queryKey: balancesKey(id) })),
  ]);
