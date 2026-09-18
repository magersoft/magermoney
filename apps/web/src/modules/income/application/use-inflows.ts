import { computed, type ComputedRef, type MaybeRefOrGetter, toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import type { InflowDto } from '@magermoney/contracts';
import type { Inflow } from '@magermoney/domain';
import { useCurrencyRegistry } from '@/modules/currencies';
import { useApi } from '@/shared/api/use-api';
import { toInflow } from '../domain/mappers';
import { inflowsApi } from '../infrastructure/inflows-api';

export interface InflowParams {
  from?: string | undefined;
  to?: string | undefined;
  sourceId?: string | undefined;
}

/** Every inflow list, whatever window or source it is filtered by. */
export const INFLOWS_KEY = ['inflows'] as const;
/** Nulls rather than missing keys, so `{}` and `{ from: undefined }` are one cache entry. */
export const inflowsKey = (p: InflowParams) =>
  ['inflows', { from: p.from ?? null, to: p.to ?? null, sourceId: p.sourceId ?? null }] as const;

/** Whether a row belongs in the list these params describe — what an optimistic insert has to decide per cache entry. */
export function matchesInflowParams(
  row: { receivedOn: string; incomeSourceId: string },
  p: InflowParams,
): boolean {
  if (p.from && row.receivedOn < p.from) return false;
  if (p.to && row.receivedOn > p.to) return false;
  if (p.sourceId && row.incomeSourceId !== p.sourceId) return false;
  return true;
}

export function useInflows(params: MaybeRefOrGetter<InflowParams>): {
  inflows: ComputedRef<Inflow[]>;
  dtos: ComputedRef<InflowDto[]>;
  isLoading: ComputedRef<boolean>;
  isError: ComputedRef<boolean>;
  refetch: () => void;
} {
  const api = inflowsApi(useApi());
  const registry = useCurrencyRegistry();
  const query = useQuery({
    queryKey: computed(() => inflowsKey(toValue(params))),
    queryFn: () => api.list(toValue(params)),
  });
  const dtos = computed(() => query.data.value ?? []);
  return {
    dtos,
    inflows: computed(() => dtos.value.map((d) => toInflow(d, registry.value))),
    isLoading: computed(() => query.isLoading.value),
    isError: computed(() => query.isError.value),
    refetch: () => void query.refetch(),
  };
}
