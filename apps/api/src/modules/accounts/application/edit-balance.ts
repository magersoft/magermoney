import { err, ok, type Result } from 'neverthrow';
import type { BalanceEntryDto, UpdateBalanceInput } from '@magermoney/contracts';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/http.js';
import type { Repos } from '../../../app.js';
import type { BalanceEntryPatch, BalanceEntryRow } from './balance-repository.js';
import type { AccountDeps } from './create-account.js';
import { notInFuture, toBalanceDto } from './dto.js';

/** A manual entry can change only while it is the newest one on its account. */
export async function assertEditable(
  repos: Pick<Repos, 'balances'>,
  userId: string,
  entry: BalanceEntryRow,
): Promise<Result<void, ConflictError>> {
  if (entry.origin !== 'manual')
    return err(new ConflictError('entry_not_manual', 'Change the transfer instead'));
  const latest = await repos.balances.latest(userId, entry.accountId);
  if (latest?.id !== entry.id)
    return err(
      new ConflictError(
        'entry_not_latest',
        'Only the latest entry can change; add a new one instead',
      ),
    );
  return ok(undefined);
}

export const editBalance =
  (deps: AccountDeps) =>
  async (
    userId: string,
    id: string,
    input: UpdateBalanceInput,
  ): Promise<Result<BalanceEntryDto, NotFoundError | ConflictError | ValidationError>> =>
    // Which entry is the latest is decided and acted on inside one transaction,
    // behind the account lock: a concurrent `recordBalance` waits for it.
    deps.uow(async (repos) => {
      const found = await repos.balances.findById(userId, id);
      if (!found) return err(new NotFoundError('balance entry'));
      await repos.accounts.lock(userId, [found.accountId]);
      // Re-read once the lock is held: whatever was written in between is visible now.
      const entry = await repos.balances.findById(userId, id);
      if (!entry) return err(new NotFoundError('balance entry'));
      const editable = await assertEditable(repos, userId, entry);
      if (editable.isErr()) return err(editable.error);
      if (input.recordedAt !== undefined) {
        if (!notInFuture(input.recordedAt, deps.clock.now()))
          return err(
            new ValidationError('A balance cannot be dated in the future', 'recorded_in_future'),
          );
        const [, second] = await repos.balances.listByAccount(userId, entry.accountId, 2);
        if (second && input.recordedAt < second.recordedAt)
          return err(
            new ValidationError(
              'The entry must stay the latest one; record a new entry instead',
              'recorded_before_previous',
            ),
          );
      }
      const row = await repos.balances.update(userId, id, input as BalanceEntryPatch);
      return row ? ok(toBalanceDto(row)) : err(new NotFoundError('balance entry'));
    });
