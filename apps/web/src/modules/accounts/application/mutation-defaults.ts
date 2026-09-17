import type { QueryClient } from '@tanstack/vue-query';
import type { AccountDto, BalanceEntryDto, RecordBalanceInput } from '@magermoney/contracts';
import type { ApiClient } from '@/shared/api/client';
import { assertOwner } from '@/shared/api/offline-write';
import { accountsApi } from '../infrastructure/accounts-api';
import { ACCOUNTS_KEY, balancesKey } from './use-accounts';

/**
 * Recording a balance is the one thing that must survive a closed tab: it is
 * what a person does on a plane, in a lift, in a shop with no signal. A stable
 * mutation key plus defaults registered on the client is what lets a paused
 * mutation be restored from IndexedDB and replayed — a restored mutation has no
 * component, so its function and its optimistic patch cannot live in the
 * composable alone.
 */
export const RECORD_BALANCE_KEY = ['accounts', 'record-balance'] as const;

export interface RecordBalanceVars {
  /** Who made the write; checked against the session before it is sent, never part of the body. */
  ownerId: string | null;
  id: string;
  input: RecordBalanceInput;
}
export interface RecordBalanceContext {
  prev: AccountDto[] | undefined;
}

/**
 * Registers what a `recordBalance` mutation does, optimistic patch included, on
 * the given client. Called by the composition root at start-up (so a restored
 * mutation can replay before any screen is open) and again by the composable
 * (so a test mounting a bare client behaves the same way); registering twice is
 * the same registration.
 */
export function registerAccountMutations(
  queryClient: QueryClient,
  client: ApiClient,
  signedInId: () => string | null = () => null,
): void {
  const api = accountsApi(client);
  queryClient.setMutationDefaults(RECORD_BALANCE_KEY, {
    // The owner id travels with the mutation, not in the request: it decides
    // whether the write may be sent at all, and the API knows the user from the token.
    mutationFn: ({ ownerId, id, input }: RecordBalanceVars): Promise<BalanceEntryDto> => {
      assertOwner(ownerId, signedInId());
      return api.recordBalance(id, input);
    },
    // The new number is shown before the POST answers and taken back if it
    // fails. A backdated entry does not touch the shown balance: the server
    // decides what is current, and the refetch after settle agrees with it.
    onMutate: async ({ id, input }: RecordBalanceVars): Promise<RecordBalanceContext> => {
      await queryClient.cancelQueries({ queryKey: ACCOUNTS_KEY });
      const prev = queryClient.getQueryData<AccountDto[]>(ACCOUNTS_KEY);
      const recordedAt = input.recordedAt ?? new Date().toISOString();
      queryClient.setQueryData<AccountDto[]>(ACCOUNTS_KEY, (list) =>
        (list ?? []).map((a) =>
          a.id === id && (a.balanceRecordedAt === null || recordedAt >= a.balanceRecordedAt)
            ? { ...a, balance: input.amount, balanceRecordedAt: recordedAt }
            : a,
        ),
      );
      return { prev };
    },
    onError: (
      _e: unknown,
      _vars: RecordBalanceVars,
      ctx: RecordBalanceContext | undefined,
    ): void => {
      if (ctx?.prev) queryClient.setQueryData(ACCOUNTS_KEY, ctx.prev);
    },
    onSettled: (
      _data: BalanceEntryDto | undefined,
      _e: unknown,
      { id }: RecordBalanceVars,
    ): Promise<unknown> =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
        queryClient.invalidateQueries({ queryKey: balancesKey(id) }),
      ]),
  });
}
