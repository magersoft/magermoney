import { computed } from 'vue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { AccountDto, CreateAccountInput, UpdateAccountInput } from '@magermoney/contracts';
import { useApi, useOwnerId } from '@/shared/api/use-api';
import { accountsApi } from '../infrastructure/accounts-api';
import { ACCOUNTS_KEY } from './use-accounts';
import {
  registerAccountMutations,
  UPDATE_ACCOUNT_KEY,
  type UpdateAccountVars,
} from './mutation-defaults';

const replaceIn = (list: AccountDto[] | undefined, dto: AccountDto) =>
  (list ?? []).map((a) => (a.id === dto.id ? dto : a));

export function useCreateAccount() {
  const api = accountsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: api.create,
    onSuccess: (dto) =>
      qc.setQueryData<AccountDto[]>(ACCOUNTS_KEY, (list) => [...(list ?? []), dto]),
    onSettled: () => qc.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
  });
  return { create: (input: CreateAccountInput) => m.mutateAsync(input), isPending: m.isPending };
}

/**
 * Editing an account, including the colour of its card and the star that puts
 * it on Home. What the mutation does lives in the client's defaults
 * (`mutation-defaults.ts`), so an edit made with no connection is parked on the
 * device and goes out by itself — a restored mutation has no component, and its
 * function and optimistic patch cannot live in this composable alone.
 */
export function useUpdateAccount() {
  const qc = useQueryClient();
  const ownerId = useOwnerId();
  registerAccountMutations(qc, useApi(), ownerId);
  const m = useMutation<AccountDto, Error, UpdateAccountVars>({ mutationKey: UPDATE_ACCOUNT_KEY });
  return {
    update: (id: string, input: UpdateAccountInput) =>
      m.mutateAsync({ ownerId: ownerId(), id, input }),
    /* A parked edit is not pending on anything the person should wait for. */
    isPending: computed(() => m.isPending.value && !m.isPaused.value),
  };
}

export function useArchiveAccount() {
  const api = accountsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) => api.archive(id, archived),
    onSuccess: (dto) => qc.setQueryData<AccountDto[]>(ACCOUNTS_KEY, (list) => replaceIn(list, dto)),
    onSettled: () => qc.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
  });
  return {
    setArchived: (id: string, archived: boolean) => m.mutateAsync({ id, archived }),
    isPending: m.isPending,
  };
}

export function useDeleteAccount() {
  const api = accountsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: api.remove,
    onSuccess: (_v, id) =>
      qc.setQueryData<AccountDto[]>(ACCOUNTS_KEY, (list) =>
        (list ?? []).filter((a) => a.id !== id),
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
  });
  return { remove: (id: string) => m.mutateAsync(id), isPending: m.isPending };
}
