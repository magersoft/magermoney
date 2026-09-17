import { computed } from 'vue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type {
  BalanceEntryDto,
  RecordBalanceInput,
  UpdateBalanceInput,
} from '@magermoney/contracts';
import { settledOrParked } from '@/shared/api/offline-write';
import { useApi, useOwnerId } from '@/shared/api/use-api';
import { accountsApi } from '../infrastructure/accounts-api';
import { ACCOUNTS_KEY, balancesKey } from './use-accounts';
import {
  RECORD_BALANCE_KEY,
  registerAccountMutations,
  type RecordBalanceVars,
} from './mutation-defaults';

/**
 * Recording a balance is the most frequent thing a person does here. What the
 * mutation does — the POST, the optimistic patch, the rollback — lives in the
 * client's mutation defaults, so a mutation that paused offline and was
 * restored from IndexedDB behaves exactly like one this screen started.
 */
export function useRecordBalance() {
  const qc = useQueryClient();
  const ownerId = useOwnerId();
  registerAccountMutations(qc, useApi(), ownerId);
  const m = useMutation<BalanceEntryDto, Error, RecordBalanceVars>({
    mutationKey: RECORD_BALANCE_KEY,
  });
  return {
    /** Resolves `'parked'` when the write is waiting for a connection, so the sheet can close. */
    record: (id: string, input: RecordBalanceInput) =>
      settledOrParked(m.mutateAsync({ ownerId: ownerId(), id, input }), m.isPaused),
    // A parked write is not pending on anything the person should wait for.
    isPending: computed(() => m.isPending.value && !m.isPaused.value),
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
