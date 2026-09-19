import { routeComponent } from '@/shared/layout/route-fallback';

/** Public API of the transfers module. */
export { useTransfers } from './application/use-transfers';
export { TRANSFERS_KEY, registerTransferMutations, CREATE_TRANSFER_KEY } from './offline';
export {
  useCreateTransfer,
  useUpdateTransfer,
  useDeleteTransfer,
} from './application/use-transfer-mutations';
export { default as TransferSheet } from './ui/TransferSheet.vue';
/** Routed screen, async for the same reason as the accounts pages. */
export const TransfersPage = routeComponent(() => import('./ui/TransfersPage.vue'));
