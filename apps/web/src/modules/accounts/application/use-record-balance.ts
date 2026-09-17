import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { AccountDto, RecordBalanceInput, UpdateBalanceInput } from '@magermoney/contracts';
import { useApi } from '@/shared/api/use-api';
import { accountsApi } from '../infrastructure/accounts-api';
import { ACCOUNTS_KEY, balancesKey } from './use-accounts';

/**
 * Recording a balance is the most frequent thing a person does here, so the
 * new number is shown before the POST answers and taken back if it fails.
 * A backdated entry does not touch the shown balance: the server decides
 * what is current, and the refetch after settle agrees with it.
 */
export function useRecordBalance() {
  const api = accountsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id, input }: { id: string; input: RecordBalanceInput }) =>
      api.recordBalance(id, input),
    onMutate: async ({ id, input }) => {
      await qc.cancelQueries({ queryKey: ACCOUNTS_KEY });
      const prev = qc.getQueryData<AccountDto[]>(ACCOUNTS_KEY);
      const recordedAt = input.recordedAt ?? new Date().toISOString();
      qc.setQueryData<AccountDto[]>(ACCOUNTS_KEY, (list) =>
        (list ?? []).map((a) =>
          a.id === id && (a.balanceRecordedAt === null || recordedAt >= a.balanceRecordedAt)
            ? { ...a, balance: input.amount, balanceRecordedAt: recordedAt }
            : a,
        ),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(ACCOUNTS_KEY, ctx.prev);
    },
    onSettled: (_d, _e, { id }) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
        qc.invalidateQueries({ queryKey: balancesKey(id) }),
      ]),
  });
  return {
    record: (id: string, input: RecordBalanceInput) => m.mutateAsync({ id, input }),
    isPending: m.isPending,
  };
}

export function useEditBalance() {
  const api = accountsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({
      entryId,
      input,
    }: {
      entryId: string;
      accountId: string;
      input: UpdateBalanceInput;
    }) => api.editBalance(entryId, input),
    onSettled: (_d, _e, { accountId }) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
        qc.invalidateQueries({ queryKey: balancesKey(accountId) }),
      ]),
  });
  return {
    edit: (accountId: string, entryId: string, input: UpdateBalanceInput) =>
      m.mutateAsync({ accountId, entryId, input }),
    isPending: m.isPending,
  };
}

export function useDeleteBalance() {
  const api = accountsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ entryId }: { entryId: string; accountId: string }) => api.deleteBalance(entryId),
    onSettled: (_d, _e, { accountId }) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
        qc.invalidateQueries({ queryKey: balancesKey(accountId) }),
      ]),
  });
  return {
    remove: (accountId: string, entryId: string) => m.mutateAsync({ accountId, entryId }),
    isPending: m.isPending,
  };
}
