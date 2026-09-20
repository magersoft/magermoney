import { err, ok, type Result } from 'neverthrow';
import {
  applyTransfer,
  deriveTransfer,
  Money,
  TransferError,
  type Clock,
  type CurrencyLookup,
  type CurrencyMismatchError,
  type InsufficientFundsError,
  type UnknownCurrencyError,
} from '@magermoney/domain';
import type { CreateTransferInput, TransferDto } from '@magermoney/contracts';
import type { Repos } from '../../../app.js';
import type { UnitOfWork } from '../../../shared/db/unit-of-work.js';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/http.js';
import type { AccountRow } from '../../accounts/application/account-repository.js';
import { notInFuture } from '../../accounts/application/dto.js';
import { toTransferDto } from './dto.js';

export interface TransferDeps {
  uow: UnitOfWork<Repos>;
  repos: Repos;
  registry: CurrencyLookup;
  clock: Clock;
}
export type TransferFailure =
  | NotFoundError
  | ValidationError
  | ConflictError
  | TransferError
  | InsufficientFundsError
  | CurrencyMismatchError
  | UnknownCurrencyError;

/** Locks both accounts and resolves their currencies; the same preamble serves create, update and delete. */
export async function lockPair(
  deps: TransferDeps,
  repos: Repos,
  userId: string,
  fromId: string,
  toId: string,
) {
  if (fromId === toId) return err(new TransferError('same_account'));
  const rows = await repos.accounts.lock(userId, [fromId, toId]);
  const from = rows.find((a) => a.id === fromId);
  const to = rows.find((a) => a.id === toId);
  if (!from || !to) return err(new NotFoundError('account'));
  return deps.registry
    .get(from.currency)
    .andThen((fromCur) =>
      deps.registry.get(to.currency).map((toCur) => ({ from, to, fromCur, toCur })),
    );
}

/** Balance as Money, zero when the account has no entry yet. */
export const balanceOf = (a: AccountRow, cur: Parameters<typeof Money.of>[1]) =>
  a.balance === null ? Money.zero(cur) : Money.of(a.balance, cur);

export function resolveAmounts(
  input: { amountSent: string; amountReceived?: string | undefined },
  pair: { fromCur: { code: string }; toCur: { code: string } },
): Result<{ amountReceived: string }, ValidationError> {
  if (pair.fromCur.code !== pair.toCur.code && input.amountReceived === undefined)
    return err(
      new ValidationError(
        'amountReceived is required when currencies differ',
        'amount_received_required',
      ),
    );
  return ok({ amountReceived: input.amountReceived ?? input.amountSent });
}

export const createTransfer =
  (deps: TransferDeps) =>
  (userId: string, input: CreateTransferInput): Promise<Result<TransferDto, TransferFailure>> =>
    deps.uow(async (repos) => {
      const pair = await lockPair(deps, repos, userId, input.fromAccountId, input.toAccountId);
      if (pair.isErr()) return err(pair.error);
      const { from, to, fromCur, toCur } = pair.value;
      const now = deps.clock.now();
      const occurredAt = input.occurredAt ?? now.toISOString();
      if (!notInFuture(occurredAt, now))
        return err(
          new ValidationError('A transfer cannot be dated in the future', 'recorded_in_future'),
        );
      if (
        (from.balanceRecordedAt && from.balanceRecordedAt > occurredAt) ||
        (to.balanceRecordedAt && to.balanceRecordedAt > occurredAt)
      )
        return err(
          new ConflictError(
            'transfer_not_latest',
            'Newer balances exist on one of the accounts; record the transfer with a later date',
          ),
        );
      const amounts = resolveAmounts(input, pair.value);
      if (amounts.isErr()) return err(amounts.error);
      const sent = Money.of(input.amountSent, fromCur);
      const received = Money.of(amounts.value.amountReceived, toCur);
      const derived = deriveTransfer({ amountSent: sent, amountReceived: received });
      if (derived.isErr()) return err(derived.error);
      const applied = applyTransfer({
        from: { kind: from.kind, cardType: from.cardType, balance: balanceOf(from, fromCur) },
        toBalance: balanceOf(to, toCur),
        amountSent: sent,
        amountReceived: received,
      });
      if (applied.isErr()) return err(applied.error);
      const row = await repos.transfers.insert(userId, {
        fromAccountId: from.id,
        toAccountId: to.id,
        amountSent: sent.toString(),
        amountReceived: received.toString(),
        occurredAt,
        note: input.note ?? null,
      });
      await repos.balances.insert(userId, {
        accountId: from.id,
        amount: applied.value.fromAfter.toString(),
        recordedAt: occurredAt,
        origin: 'transfer',
        transferId: row.id,
        note: null,
      });
      await repos.balances.insert(userId, {
        accountId: to.id,
        amount: applied.value.toAfter.toString(),
        recordedAt: occurredAt,
        origin: 'transfer',
        transferId: row.id,
        note: null,
      });
      return ok(toTransferDto(row, fromCur, toCur));
    });
