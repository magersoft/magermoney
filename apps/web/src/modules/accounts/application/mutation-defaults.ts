import type { QueryClient } from '@tanstack/vue-query';
import type {
  AccountDto,
  BalanceEntryDto,
  RecordBalanceInput,
  UpdateAccountInput,
} from '@magermoney/contracts';
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

/**
 * Editing an account has to survive a closed tab for the same reason: most of
 * what this mutation carries — the colour of a card, the star that puts it on
 * Home, a corrected name — is changed while looking at the account, and none of
 * it is worth losing because the lift had no signal. Unlike a balance, an edit
 * is safe to replay: it sets fields rather than adding a row.
 */
export const UPDATE_ACCOUNT_KEY = ['accounts', 'update'] as const;

export interface UpdateAccountVars {
  ownerId: string | null;
  id: string;
  input: UpdateAccountInput;
}
export interface AccountsSnapshot {
  prev: AccountDto[] | undefined;
}

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

  queryClient.setMutationDefaults(UPDATE_ACCOUNT_KEY, {
    mutationFn: ({ ownerId, id, input }: UpdateAccountVars): Promise<AccountDto> => {
      assertOwner(ownerId, signedInId());
      return api.update(id, input);
    },
    /*
     * The edit shows on every card at once — the stack, the strip, the account's
     * own screen all read this one list — and stays shown while the PATCH is on
     * its way, or parked. Merged into the cached account rather than replacing
     * it, because the input is a patch: the fields it leaves out keep their
     * values, exactly as the API will decide them.
     */
    onMutate: async ({ id, input }: UpdateAccountVars): Promise<AccountsSnapshot> => {
      await queryClient.cancelQueries({ queryKey: ACCOUNTS_KEY });
      const prev = queryClient.getQueryData<AccountDto[]>(ACCOUNTS_KEY);
      queryClient.setQueryData<AccountDto[]>(ACCOUNTS_KEY, (list) =>
        (list ?? []).map((a) => (a.id === id ? { ...a, ...input } : a)),
      );
      return { prev };
    },
    onError: (_e: unknown, _vars: UpdateAccountVars, ctx: AccountsSnapshot | undefined): void => {
      if (ctx?.prev) queryClient.setQueryData(ACCOUNTS_KEY, ctx.prev);
    },
    onSuccess: (dto: AccountDto): void => {
      queryClient.setQueryData<AccountDto[]>(ACCOUNTS_KEY, (list) =>
        (list ?? []).map((a) => (a.id === dto.id ? dto : a)),
      );
    },
    onSettled: (): Promise<unknown> => queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
  });

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
