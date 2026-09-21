import { routeComponent } from '@/shared/layout/route-fallback';

/** Public API of the assets module: money that has already become a thing. */
export { toAsset, toValuation } from './domain/mappers';
export { ASSETS_KEY, useAssets, valuationsKey } from './application/use-assets';
export { useValuations } from './application/use-valuations';
export {
  useAddValuation,
  useCreateAsset,
  useDeleteAsset,
  useDeleteValuation,
  useUpdateAsset,
  useUpdateValuation,
} from './application/use-asset-mutations';
export { default as AssetsSegment } from './ui/AssetsSegment.vue';
export { default as AssetRow } from './ui/AssetRow.vue';
/** Routed screens, async: the Savings screen imports this barrel statically. */
export const AssetPage = routeComponent(() => import('./ui/AssetPage.vue'));
export const AssetFormPage = routeComponent(() => import('./ui/AssetFormPage.vue'));
