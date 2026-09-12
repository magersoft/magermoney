import type { AccountDto } from '@magermoney/contracts';
import type { Repos } from '../../../app.js';
import { toAccountDto } from './dto.js';

export const listAccounts =
  (repos: Pick<Repos, 'accounts'>) =>
  async (userId: string): Promise<AccountDto[]> =>
    (await repos.accounts.list(userId)).map(toAccountDto);
