import { computed, type ComputedRef } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import type { AssetDto } from '@magermoney/contracts';
import type { Asset } from '@magermoney/domain';
import { useCurrencyRegistry } from '@/modules/currencies';
import { useApi } from '@/shared/api/use-api';
import { toAsset } from '../domain/mappers';
import { assetsApi } from '../infrastructure/assets-api';

export const ASSETS_KEY = ['assets'] as const;
export const valuationsKey = (assetId: string) => ['assets', assetId, 'valuations'] as const;

/** Every asset, archived ones included: the segment decides what it shows. */
export function useAssets(): {
  assets: ComputedRef<Asset[]>;
  dtos: ComputedRef<AssetDto[]>;
  isLoading: ComputedRef<boolean>;
  isError: ComputedRef<boolean>;
  refetch: () => void;
} {
  const api = assetsApi(useApi());
  const registry = useCurrencyRegistry();
  const query = useQuery({ queryKey: ASSETS_KEY, queryFn: api.list });
  const dtos = computed(() => query.data.value ?? []);
  return {
    dtos,
    assets: computed(() => dtos.value.map((d) => toAsset(d, registry.value))),
    isLoading: computed(() => query.isLoading.value),
    isError: computed(() => query.isError.value),
    refetch: () => void query.refetch(),
  };
}
