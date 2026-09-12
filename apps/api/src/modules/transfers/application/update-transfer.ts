import { err, ok, type Result } from 'neverthrow';
import { applyTransfer, deriveTransfer, Money } from '@magermoney/domain';
import type { TransferDto, UpdateTransferInput } from '@magermoney/contracts';
import type { Repos } from '../../../app.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/http.js';
import { notInFuture } from '../../accounts/application/dto.js';
import type { BalanceEntryRow } from '../../accounts/application/balance-repository.js';
import { balanceOf, lockPair, type TransferDeps, type TransferFailure } from './create-transfer.js';
import { toTransferDto } from './dto.js';
import type { TransferRow } from './transfer-repository.js';

/** The transfer's two entries must still be the newest on their accounts; otherwise later history depends on them. */
export async function latestEntriesOf(
  repos: Repos,
  userId: string,
  t: TransferRow,
): Promise<Result<{ fromEntry: BalanceEntryRow; toEntry: BalanceEntryRow }, ConflictError>> {
  const entries = await repos.balances.findByTransfer(userId, t.id);
  const fromEntry = entries.find((e) => e.accountId === t.fromAccountId);
  const toEntry = entries.find((e) => e.accountId === t.toAccountId);
  const [latestFrom, latestTo] = await Promise.all([
    repos.balances.latest(userId, t.fromAccountId),
    repos.balances.latest(userId, t.toAccountId),
  ]);
  if (!fromEntry || !toEntry || latestFrom?.id !== fromEntry.id || latestTo?.id !== toEntry.id)
    return err(
      new ConflictError(
        'transfer_not_latest',
        'Newer balances exist on one of the accounts; record a correcting transfer instead',
      ),
    );
  return ok({ fromEntry, toEntry });
}

export const updateTransfer =
  (deps: TransferDeps) =>
  (
    userId: string,
    id: string,
    input: UpdateTransferInput,
  ): Promise<Result<TransferDto, TransferFailure | ConflictError>> =>
    deps.uow(async (repos) => {
      // Learn the accounts before locking; the fresh row read after `lockPair` is what all
      // arithmetic below uses, so a concurrent edit can't be raced between the two reads.
      const existing = await repos.transfers.findById(userId, id);
      if (!existing) return err(new NotFoundError('transfer'));
      const pair = await lockPair(
        deps,
        repos,
        userId,
        input.fromAccountId ?? existing.fromAccountId,
        input.toAccountId ?? existing.toAccountId,
      );
      if (pair.isErr()) return err(pair.error);
      if (
        pair.value.from.id !== existing.fromAccountId ||
        pair.value.to.id !== existing.toAccountId
      )
        return err(
          new ValidationError(
            'Accounts of a transfer cannot change; delete it and create a new one',
            'accounts_immutable',
          ),
        );
      const current = await repos.transfers.findById(userId, id);
      if (!current) return err(new NotFoundError('transfer'));
      const { from, to, fromCur, toCur } = pair.value;
      const latest = await latestEntriesOf(repos, userId, current);
      if (latest.isErr()) return err(latest.error);
      const now = deps.clock.now();
      const occurredAt = input.occurredAt ?? current.occurredAt;
      if (!notInFuture(occurredAt, now))
        return err(
          new ValidationError('A transfer cannot be dated in the future', 'recorded_in_future'),
        );
      if (occurredAt !== current.occurredAt) {
        const [fromEntries, toEntries] = await Promise.all([
          repos.balances.listByAccount(userId, from.id, 2),
          repos.balances.listByAccount(userId, to.id, 2),
        ]);
        const fromSecond = fromEntries[1];
        const toSecond = toEntries[1];
        if (
          (fromSecond && occurredAt < fromSecond.recordedAt) ||
          (toSecond && occurredAt < toSecond.recordedAt)
        )
          return err(
            new ConflictError(
              'transfer_not_latest',
              'Newer balances exist on one of the accounts; record the transfer with a later date',
            ),
          );
      }
      const amountSent = input.amountSent ?? current.amountSent;
      // Same-currency partial edit preserves the fee instead of silently defaulting received to
      // sent; cross-currency stays as-is (received unchanged unless given explicitly).
      let amountReceived: string;
      if (input.amountReceived !== undefined) {
        amountReceived = input.amountReceived;
      } else if (input.amountSent !== undefined && fromCur.code === toCur.code) {
        const storedFee = Money.of(current.amountSent, fromCur)
          .subtract(Money.of(current.amountReceived, toCur))
          ._unsafeUnwrap();
        const receivedResult = Money.of(amountSent, fromCur).subtract(storedFee);
        if (receivedResult.isErr()) return err(receivedResult.error);
        amountReceived = receivedResult.value.toString();
      } else {
        amountReceived = current.amountReceived;
      }
      const sent = Money.of(amountSent, fromCur);
      const received = Money.of(amountReceived, toCur);
      const derived = deriveTransfer({ amountSent: sent, amountReceived: received });
      if (derived.isErr()) return err(derived.error);
      // Undo the old movement, then apply the new one to the balances as they were before this transfer.
      const fromBefore = balanceOf(from, fromCur)
        .add(Money.of(current.amountSent, fromCur))
        ._unsafeUnwrap();
      const toBefore = balanceOf(to, toCur)
        .subtract(Money.of(current.amountReceived, toCur))
        ._unsafeUnwrap();
      const applied = applyTransfer({
        from: { kind: from.kind, cardType: from.cardType, balance: fromBefore },
        toBalance: toBefore,
        amountSent: sent,
        amountReceived: received,
      });
      if (applied.isErr()) return err(applied.error);
      const row = await repos.transfers.update(userId, id, {
        amountSent: sent.toString(),
        amountReceived: received.toString(),
        occurredAt,
        note: input.note === undefined ? current.note : input.note,
      });
      await repos.balances.update(userId, latest.value.fromEntry.id, {
        amount: applied.value.fromAfter.toString(),
        recordedAt: occurredAt,
      });
      await repos.balances.update(userId, latest.value.toEntry.id, {
        amount: applied.value.toAfter.toString(),
        recordedAt: occurredAt,
      });
      return ok(toTransferDto(row!, fromCur, toCur));
    });
