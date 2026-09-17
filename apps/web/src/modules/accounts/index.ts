/** Public API of the accounts module: the list, the journal, and the home screen built from them. */
import { defineComponent, h } from 'vue';

export { toAccount } from './domain/mappers';
export { ACCOUNT_KIND_KEYS } from './domain/labels';
export { useAccounts, useAccount, ACCOUNTS_KEY } from './application/use-accounts';
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

/**
 * Placeholders until Task 14 delivers the real screens — kept here, not
 * inline in the router, so the router never imports past a module's public
 * API.
 */
export const AccountFormPage = defineComponent({
  name: 'AccountFormPage',
  setup: () => () => h('div'),
});
export const AccountDetailPage = defineComponent({
  name: 'AccountDetailPage',
  setup: () => () => h('div'),
});
