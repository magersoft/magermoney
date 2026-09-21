import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type {
  AssetInput,
  UpdateAssetInput,
  UpdateValuationInput,
  ValuationInput,
} from '@magermoney/contracts';
import { useApi } from '@/shared/api/use-api';
import { assetsApi } from '../infrastructure/assets-api';
import { ASSETS_KEY, valuationsKey } from './use-assets';

export function useCreateAsset() {
  const api = assetsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: api.create,
    onSettled: () => qc.invalidateQueries({ queryKey: ASSETS_KEY }),
  });
  return { create: (input: AssetInput) => m.mutateAsync(input), isPending: m.isPending };
}

export function useUpdateAsset() {
  const api = assetsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAssetInput }) => api.update(id, input),
    onSettled: () => qc.invalidateQueries({ queryKey: ASSETS_KEY }),
  });
  return {
    update: (id: string, input: UpdateAssetInput) => m.mutateAsync({ id, input }),
    isPending: m.isPending,
  };
}

export function useDeleteAsset() {
  const api = assetsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: api.remove,
    onSettled: () => qc.invalidateQueries({ queryKey: ASSETS_KEY }),
  });
  return { remove: (id: string) => m.mutateAsync(id), isPending: m.isPending };
}

/**
 * A valuation changes what the asset is worth, so both the journal and the list
 * that reads its last row are stale afterwards.
 */
function invalidateBoth(qc: ReturnType<typeof useQueryClient>, assetId: string) {
  return async () => {
    await qc.invalidateQueries({ queryKey: valuationsKey(assetId) });
    await qc.invalidateQueries({ queryKey: ASSETS_KEY });
  };
}

export function useAddValuation(assetId: string) {
  const api = assetsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (input: ValuationInput) => api.addValuation(assetId, input),
    onSettled: invalidateBoth(qc, assetId),
  });
  return { add: (input: ValuationInput) => m.mutateAsync(input), isPending: m.isPending };
}

export function useUpdateValuation(assetId: string) {
  const api = assetsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateValuationInput }) =>
      api.updateValuation(id, input),
    onSettled: invalidateBoth(qc, assetId),
  });
  return {
    update: (id: string, input: UpdateValuationInput) => m.mutateAsync({ id, input }),
    isPending: m.isPending,
  };
}

export function useDeleteValuation(assetId: string) {
  const api = assetsApi(useApi());
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: api.removeValuation,
    onSettled: invalidateBoth(qc, assetId),
  });
  return { remove: (id: string) => m.mutateAsync(id), isPending: m.isPending };
}
