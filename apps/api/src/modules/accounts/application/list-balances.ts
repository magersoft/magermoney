import { err, ok, type Result } from 'neverthrow';
import type { BalanceEntryDto, CursorQuery } from '@magermoney/contracts';
import { NotFoundError } from '../../../shared/errors/http.js';
import type { AccountDeps } from './create-account.js';
import { toBalanceDto } from './dto.js';

export const listBalances =
  (deps: AccountDeps) =>
  async (
    userId: string,
    accountId: string,
    query: CursorQuery,
  ): Promise<Result<BalanceEntryDto[], NotFoundError>> => {
    if (!(await deps.repos.accounts.findById(userId, accountId)))
      return err(new NotFoundError('account'));
    const rows = await deps.repos.balances.listByAccount(
      userId,
      accountId,
      query.limit,
      query.before,
    );
    return ok(rows.map(toBalanceDto));
  };
