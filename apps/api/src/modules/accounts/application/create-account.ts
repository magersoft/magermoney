import { err, ok, type Result } from 'neverthrow';
import { UnknownCurrencyError, type Clock, type CurrencyLookup } from '@magermoney/domain';
import type { AccountDto, CreateAccountInput } from '@magermoney/contracts';
import type { Repos } from '../../../app.js';
import type { UnitOfWork } from '../../../shared/db/unit-of-work.js';
import { ValidationError } from '../../../shared/errors/http.js';
import type { NewAccount } from './account-repository.js';
import { notInFuture, toAccountDto } from './dto.js';

export interface AccountDeps {
  /** Balance writes and the account delete take the account lock inside one transaction, exactly like transfers. */
  uow: UnitOfWork<Repos>;
  repos: Pick<Repos, 'accounts' | 'balances' | 'transfers' | 'goals'>;
  registry: CurrencyLookup;
  clock: Clock;
}

export const toNewAccount = (input: Omit<CreateAccountInput, 'openingBalance'>): NewAccount => ({
  name: input.name,
  bank: input.bank,
  country: input.country,
  currency: input.currency,
  kind: input.kind,
  cardType: input.kind === 'card' ? (input.cardType ?? null) : null,
  isSpending: input.isSpending,
  isPinned: input.isPinned ?? false,
  cardLast4: input.kind === 'card' ? (input.cardLast4 ?? null) : null,
  cardNetwork: input.kind === 'card' ? (input.cardNetwork ?? null) : null,
  cardTier: input.kind === 'card' ? (input.cardTier ?? null) : null,
  cardExpires: input.kind === 'card' ? (input.cardExpires ?? null) : null,
  /* Not gated on `kind`: every account is drawn as a card, so every one may be painted. */
  colorway: input.colorway ?? null,
  note: input.note ?? null,
  sortOrder: input.sortOrder ?? 0,
});

export const createAccount =
  (deps: AccountDeps) =>
  async (
    userId: string,
    input: CreateAccountInput,
  ): Promise<Result<AccountDto, UnknownCurrencyError | ValidationError>> => {
    if (!deps.registry.has(input.currency)) return err(new UnknownCurrencyError(input.currency));
    const { openingBalance, ...fields } = input;
    const now = deps.clock.now();
    const recordedAt = openingBalance?.recordedAt ?? now.toISOString();
    if (openingBalance && !notInFuture(recordedAt, now))
      return err(
        new ValidationError('A balance cannot be dated in the future', 'recorded_in_future'),
      );
    const row = await deps.repos.accounts.create(
      userId,
      toNewAccount(fields),
      openingBalance ? { amount: openingBalance.amount, recordedAt } : undefined,
    );
    return ok(toAccountDto(row));
  };
