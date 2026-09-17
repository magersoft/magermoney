import { err, ok, type Result } from 'neverthrow';
import type { BalanceEntryDto, RecordBalanceInput } from '@magermoney/contracts';
import { NotFoundError, ValidationError } from '../../../shared/errors/http.js';
import type { AccountDeps } from './create-account.js';
import { notInFuture, toBalanceDto } from './dto.js';

export const recordBalance =
  (deps: AccountDeps) =>
  async (
    userId: string,
    accountId: string,
    input: RecordBalanceInput,
  ): Promise<Result<BalanceEntryDto, NotFoundError | ValidationError>> =>
    // The account row is locked for the whole write, so an edit of the current
    // entry and a new entry on the same account can never interleave.
    deps.uow(async (repos) => {
      const [account] = await repos.accounts.lock(userId, [accountId]);
      if (!account) return err(new NotFoundError('account'));
      const now = deps.clock.now();
      const recordedAt = input.recordedAt ?? now.toISOString();
      if (!notInFuture(recordedAt, now))
        return err(
          new ValidationError('A balance cannot be dated in the future', 'recorded_in_future'),
        );
      const row = await repos.balances.insert(userId, {
        accountId,
        amount: input.amount,
        recordedAt,
        origin: 'manual',
        transferId: null,
        note: input.note ?? null,
      });
      return ok(toBalanceDto(row));
    });
