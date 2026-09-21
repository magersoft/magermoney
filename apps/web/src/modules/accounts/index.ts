import { routeComponent } from '@/shared/layout/route-fallback';

/** Public API of the accounts module: the list, the journal, and the capital summary built from them. */

export { toAccount } from './domain/mappers';
export { ACCOUNT_KIND_KEYS } from './domain/labels';
export { toCardItem, cardExpiry, accountReference } from './domain/account-card';
export { useAccounts, useAccount } from './application/use-accounts';
export { useAccountCards } from './application/use-account-cards';
export {
  ACCOUNTS_KEY,
  registerAccountMutations,
  RECORD_BALANCE_KEY,
  UPDATE_ACCOUNT_KEY,
} from './offline';
export {
  useCreateAccount,
  useUpdateAccount,
  useArchiveAccount,
  useDeleteAccount,
} from './application/use-account-mutations';
export {
  useRecordBalance,
  useEditBalance,
  useDeleteBalance,
} from './application/use-record-balance';
export { useAccountBalances, useBalanceJournals } from './application/use-account-balances';
export {
  useCapitalSummary,
  summarise,
  type CapitalSummary,
  type GroupSummary,
} from './application/use-capital-summary';
/**
 * The routed screens are async components: the app shell imports this barrel
 * statically (`QuickActions` needs `useAccounts` and the sheet), and a static
 * edge would drag every page into the entry chunk however lazily the router
 * asks for them.
 */
export const AccountsPage = routeComponent(() => import('./ui/AccountsPage.vue'));
export const AccountDetailPage = routeComponent(() => import('./ui/AccountDetailPage.vue'));
export const AccountFormPage = routeComponent(() => import('./ui/AccountFormPage.vue'));
export { default as RecordBalanceSheet } from './ui/RecordBalanceSheet.vue';
