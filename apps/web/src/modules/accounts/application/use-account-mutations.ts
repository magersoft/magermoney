import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { AccountDto, CreateAccountInput, UpdateAccountInput } from '@magermoney/contracts';
import { useApi } from '@/shared/api/use-api';
import { accountsApi } from '../infrastructure/accounts-api';
import { ACCOUNTS_KEY } from './use-accounts';

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

export function useUpdateAccount() {
  const api = accountsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAccountInput }) => api.update(id, input),
    onSuccess: (dto) => qc.setQueryData<AccountDto[]>(ACCOUNTS_KEY, (list) => replaceIn(list, dto)),
    onSettled: () => qc.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
  });
  return {
    update: (id: string, input: UpdateAccountInput) => m.mutateAsync({ id, input }),
    isPending: m.isPending,
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
