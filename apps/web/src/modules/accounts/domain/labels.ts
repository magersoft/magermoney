import type { AccountKind } from '@magermoney/domain';

/** i18n keys for each kind, so a screen never switches on the enum itself. */
export const ACCOUNT_KIND_KEYS: Record<AccountKind, string> = {
  bank_account: 'accounts.kind.bank_account',
  card: 'accounts.kind.card',
  deposit: 'accounts.kind.deposit',
  broker: 'accounts.kind.broker',
  crypto_wallet: 'accounts.kind.crypto_wallet',
  cash: 'accounts.kind.cash',
};
