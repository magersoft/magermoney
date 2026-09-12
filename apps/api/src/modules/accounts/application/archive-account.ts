import { err, ok, type Result } from 'neverthrow';
import type { AccountDto } from '@magermoney/contracts';
import { NotFoundError } from '../../../shared/errors/http.js';
import type { AccountDeps } from './create-account.js';
import { toAccountDto } from './dto.js';

export const setAccountArchived =
  (deps: AccountDeps) =>
  async (
    userId: string,
    id: string,
    archived: boolean,
  ): Promise<Result<AccountDto, NotFoundError>> => {
    const row = await deps.repos.accounts.setArchived(
      userId,
      id,
      archived ? deps.clock.now().toISOString() : null,
    );
    return row ? ok(toAccountDto(row)) : err(new NotFoundError('account'));
  };
