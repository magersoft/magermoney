import type { QueryClient, QueryKey } from '@tanstack/vue-query';
import type {
  AccountDto,
  CreateInflowInput,
  IncomeSourceDto,
  InflowDto,
} from '@magermoney/contracts';
import { Decimal } from '@magermoney/domain';
import { ACCOUNTS_KEY } from '@/modules/accounts/offline';
import type { ApiClient } from '@/shared/api/client';
import { assertOwner, ForeignWriteError } from '@/shared/api/offline-write';
import { inflowsApi } from '../infrastructure/inflows-api';
import { INCOME_SOURCES_KEY } from './use-income-sources';
import { invalidateAfterInflow } from './invalidate';
import { INFLOWS_KEY, matchesInflowParams, type InflowParams } from './use-inflows';

/**
 * Salary lands while a person is on the metro. Recording an inflow therefore
 * survives a closed tab exactly like recording a balance: a stable key, and
 * defaults registered on the client, so a mutation restored from IndexedDB with
 * no screen behind it still knows what to send and what to patch.
 */
export const CREATE_INFLOW_KEY = ['inflows', 'create'] as const;

export interface CreateInflowVars {
  /** Who made the write; checked against the session before it is sent, never part of the body. */
  ownerId: string | null;
  input: CreateInflowInput;
}
export interface CreateInflowContext {
  prevAccounts: AccountDto[] | undefined;
  prevInflows: [QueryKey, InflowDto[] | undefined][];
}

const todayIso = (): string => new Date().toISOString().slice(0, 10);

/** The row the lists show until the server answers. Never parsed against the contract: it lives only in the cache. */
function optimisticInflow(queryClient: QueryClient, input: CreateInflowInput): InflowDto {
  const source = queryClient
    .getQueryData<IncomeSourceDto[]>(INCOME_SOURCES_KEY)
    ?.find((s) => s.id === input.incomeSourceId);
  return {
    id: `optimistic-${Date.now()}`,
    incomeSourceId: input.incomeSourceId,
    amount: input.amount,
    currency: input.currency ?? source?.currency ?? '',
    receivedOn: input.receivedOn ?? todayIso(),
    realisedRateToUsd: input.realisedRateToUsd ?? null,
    accountId: input.accountId ?? null,
    creditedAmount: input.accountId ? (input.creditedAmount ?? input.amount) : null,
    realisedRate: null,
    note: input.note ?? null,
  };
}

export function registerIncomeMutations(
  queryClient: QueryClient,
  client: ApiClient,
  signedInId: () => string | null = () => null,
): void {
  const api = inflowsApi(client);
  queryClient.setMutationDefaults(CREATE_INFLOW_KEY, {
    mutationFn: ({ ownerId, input }: CreateInflowVars): Promise<InflowDto> => {
      assertOwner(ownerId, signedInId());
      return api.create(input);
    },
    // The receipt appears in every list whose window and source it falls into,
    // and a credited Account grows by what reached it — the credited amount
    // when currencies differ, the inflow amount otherwise. No float: the sum is
    // a Decimal and goes back into the cache as the string it came as.
    onMutate: async ({ input }: CreateInflowVars): Promise<CreateInflowContext> => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: INFLOWS_KEY }),
        queryClient.cancelQueries({ queryKey: ACCOUNTS_KEY }),
      ]);
      const prevAccounts = queryClient.getQueryData<AccountDto[]>(ACCOUNTS_KEY);
      const prevInflows = queryClient.getQueriesData<InflowDto[]>({ queryKey: INFLOWS_KEY });
      const row = optimisticInflow(queryClient, input);
      for (const [key, list] of prevInflows) {
        const params = key[1] as InflowParams | undefined;
        // `['inflows', 'create']` is this mutation's own key, not a list.
        if (!params || typeof params !== 'object' || !matchesInflowParams(row, params)) continue;
        queryClient.setQueryData<InflowDto[]>(key, [row, ...(list ?? [])]);
      }
      if (input.accountId) {
        const credit = input.creditedAmount ?? input.amount;
        queryClient.setQueryData<AccountDto[]>(ACCOUNTS_KEY, (list) =>
          (list ?? []).map((a) =>
            a.id === input.accountId
              ? { ...a, balance: new Decimal(a.balance ?? '0').plus(credit).toFixed() }
              : a,
          ),
        );
      }
      return { prevAccounts, prevInflows };
    },
    onError: (e: unknown, _vars: CreateInflowVars, ctx: CreateInflowContext | undefined): void => {
      // A write refused because it belongs to another account carries that
      // account's snapshot. Restoring it would paint the previous person's
      // money into this person's cache; the refetch in `onSettled` undoes the
      // optimistic patch instead.
      if (!ctx || e instanceof ForeignWriteError) return;
      if (ctx.prevAccounts) queryClient.setQueryData(ACCOUNTS_KEY, ctx.prevAccounts);
      for (const [key, list] of ctx.prevInflows) queryClient.setQueryData(key, list);
    },
    onSettled: (
      _d: InflowDto | undefined,
      _e: unknown,
      { input }: CreateInflowVars,
    ): Promise<unknown> =>
      invalidateAfterInflow(queryClient, input.accountId ? [input.accountId] : []),
  });
}
