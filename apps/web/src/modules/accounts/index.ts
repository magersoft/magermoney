/** Public API of the accounts module: the list, the journal, and the home screen built from them. */

export { toAccount } from './domain/mappers';
export { ACCOUNT_KIND_KEYS } from './domain/labels';
export { useAccounts, useAccount, ACCOUNTS_KEY } from './application/use-accounts';
export { registerAccountMutations, RECORD_BALANCE_KEY } from './application/mutation-defaults';
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
export { default as AccountsPage } from './ui/AccountsPage.vue';
export { default as AccountDetailPage } from './ui/AccountDetailPage.vue';
export { default as AccountFormPage } from './ui/AccountFormPage.vue';
export { default as RecordBalanceSheet } from './ui/RecordBalanceSheet.vue';
