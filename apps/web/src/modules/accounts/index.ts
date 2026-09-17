import { defineAsyncComponent } from 'vue';

/** Public API of the accounts module: the list, the journal, and the home screen built from them. */

export { toAccount } from './domain/mappers';
export { ACCOUNT_KIND_KEYS } from './domain/labels';
export { useAccounts, useAccount } from './application/use-accounts';
export { ACCOUNTS_KEY, registerAccountMutations, RECORD_BALANCE_KEY } from './offline';
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
export { useAccountBalances } from './application/use-account-balances';
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
export const AccountsPage = defineAsyncComponent(() => import('./ui/AccountsPage.vue'));
export const AccountDetailPage = defineAsyncComponent(() => import('./ui/AccountDetailPage.vue'));
export const AccountFormPage = defineAsyncComponent(() => import('./ui/AccountFormPage.vue'));
export { default as RecordBalanceSheet } from './ui/RecordBalanceSheet.vue';
