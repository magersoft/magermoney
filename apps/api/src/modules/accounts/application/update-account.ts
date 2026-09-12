import { err, ok, type Result } from 'neverthrow';
import { UnknownCurrencyError } from '@magermoney/domain';
import type { AccountDto, UpdateAccountInput } from '@magermoney/contracts';
import { ConflictError, NotFoundError } from '../../../shared/errors/http.js';
import type { AccountPatch } from './account-repository.js';
import type { AccountDeps } from './create-account.js';
import { toAccountDto } from './dto.js';

const CARD_NULLS: AccountPatch = {
  cardType: null,
  cardLast4: null,
  cardNetwork: null,
  cardTier: null,
  cardExpires: null,
};

export const updateAccount =
  (deps: AccountDeps) =>
  async (
    userId: string,
    id: string,
    input: UpdateAccountInput,
  ): Promise<Result<AccountDto, NotFoundError | ConflictError | UnknownCurrencyError>> => {
    const current = await deps.repos.accounts.findById(userId, id);
    if (!current) return err(new NotFoundError('account'));
    if (input.currency !== undefined && !deps.registry.has(input.currency))
      return err(new UnknownCurrencyError(input.currency));
    if (
      input.currency !== undefined &&
      input.currency !== current.currency &&
      (await deps.repos.accounts.countEntries(userId, id)) > 0
    )
      return err(
        new ConflictError(
          'account_has_history',
          'The currency cannot change once balances are recorded',
        ),
      );
    const kind = input.kind ?? current.kind;
    const patch = { ...input, ...(kind === 'card' ? {} : CARD_NULLS) } as AccountPatch;
    const row = await deps.repos.accounts.update(userId, id, patch);
    return row ? ok(toAccountDto(row)) : err(new NotFoundError('account'));
  };
