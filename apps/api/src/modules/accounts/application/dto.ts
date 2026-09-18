import type { AccountDto, BalanceEntryDto } from '@magermoney/contracts';
import type { AccountRow } from './account-repository.js';
import type { BalanceEntryRow } from './balance-repository.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const toAccountDto = ({ userId: _u, ...row }: AccountRow): AccountDto => row;
export const toBalanceDto = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userId: _u,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createdAt: _c,
  ...row
}: BalanceEntryRow): BalanceEntryDto => ({ ...row, inflowId: null });

/** Nothing may be dated after now: a balance "as of next week" is a guess, not a statement. */
export const notInFuture = (iso: string, now: Date): boolean =>
  new Date(iso).getTime() <= now.getTime();
