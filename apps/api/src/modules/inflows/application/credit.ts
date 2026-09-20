import { err, ok, type Result } from 'neverthrow';
import {
  applyInflow,
  deriveInflowCredit,
  Money,
  type Clock,
  type Currency,
  type CurrencyMismatchError,
  type CurrencyLookup,
  type Decimal,
  type InflowError,
  type UnknownCurrencyError,
} from '@magermoney/domain';
import type { Repos } from '../../../app.js';
import { ConflictError, ValidationError } from '../../../shared/errors/http.js';
import type { AccountRow } from '../../accounts/application/account-repository.js';
import type { BalanceEntryRow } from '../../accounts/application/balance-repository.js';
import type { InflowRow } from './inflow-repository.js';

/** The account a credit is about to land on, as it stands without that credit. */
export interface CreditTarget {
  account: AccountRow;
  currency: Currency;
  /** The balance the credit is added to. */
  base: Money;
  /** When the entry underneath was recorded; the credit must not be older than it. */
  previousRecordedAt: string | null;
}
/** Everything decided before the first write: nothing below a plan can fail. */
export interface CreditPlan {
  accountId: string;
  credited: Money;
  after: Money;
  recordedAt: string;
  realisedRate: Decimal | null;
}

const balanceOf = (a: AccountRow, cur: Currency): Money =>
  a.balance === null ? Money.zero(cur) : Money.of(a.balance, cur);

/** Today's inflow is stamped now; a past one at the end of its day, so it sorts after that day's entries. */
export const creditRecordedAt = (receivedOn: string, clock: Clock): string =>
  receivedOn === clock.today() ? clock.now().toISOString() : `${receivedOn}T23:59:59.999Z`;

/** An account that does not carry this inflow yet. The row must come from `accounts.lock`. */
export function freshTarget(
  registry: CurrencyLookup,
  account: AccountRow,
): Result<CreditTarget, UnknownCurrencyError> {
  return registry.get(account.currency).map((currency) => ({
    account,
    currency,
    base: balanceOf(account, currency),
    previousRecordedAt: account.balanceRecordedAt,
  }));
}

/**
 * The account that already carries this inflow as its latest entry, seen as if
 * the entry were gone: the balance minus what was credited, and the entry below it.
 */
export async function revertedTarget(
  registry: CurrencyLookup,
  repos: Pick<Repos, 'balances'>,
  userId: string,
  account: AccountRow,
  inflow: InflowRow,
): Promise<Result<CreditTarget, UnknownCurrencyError | CurrencyMismatchError>> {
  const currency = registry.get(account.currency);
  if (currency.isErr()) return err(currency.error);
  const [, previous] = await repos.balances.listByAccount(userId, account.id, 2);
  return balanceOf(account, currency.value)
    .subtract(Money.of(inflow.creditedAmount ?? '0', currency.value))
    .map((base) => ({
      account,
      currency: currency.value,
      base,
      previousRecordedAt: previous?.recordedAt ?? null,
    }));
}

export function planCredit(input: {
  target: CreditTarget;
  amount: Money;
  /** In the account's currency. Undefined = same as the amount, which only a same-currency credit allows. */
  creditedAmount?: string | undefined;
  receivedOn: string;
  clock: Clock;
}): Result<CreditPlan, InflowError | ValidationError | CurrencyMismatchError> {
  const { target, amount, creditedAmount, receivedOn, clock } = input;
  const recordedAt = creditRecordedAt(receivedOn, clock);
  if (target.previousRecordedAt !== null && target.previousRecordedAt > recordedAt)
    return err(
      new ValidationError(
        'Newer balances exist on the account; record the inflow without an account instead',
        'credit_not_latest',
      ),
    );
  return deriveInflowCredit({
    amount,
    accountCurrency: target.currency,
    creditedAmount:
      creditedAmount === undefined ? undefined : Money.of(creditedAmount, target.currency),
  }).andThen((derived) =>
    applyInflow({ balance: target.base, credited: derived.credited }).map((after) => ({
      accountId: target.account.id,
      credited: derived.credited,
      after,
      recordedAt,
      realisedRate: derived.realisedRate,
    })),
  );
}

export const writeCredit = (
  repos: Pick<Repos, 'balances'>,
  userId: string,
  inflowId: string,
  plan: CreditPlan,
): Promise<BalanceEntryRow> =>
  repos.balances.insert(userId, {
    accountId: plan.accountId,
    amount: plan.after.toString(),
    recordedAt: plan.recordedAt,
    origin: 'inflow',
    transferId: null,
    inflowId,
    note: null,
  });

/** A credited inflow can change only while its entry is the newest on the account; later history rests on it. */
export async function assertInflowLatest(
  repos: Pick<Repos, 'balances'>,
  userId: string,
  inflow: InflowRow,
): Promise<Result<BalanceEntryRow, ConflictError>> {
  const entry = await repos.balances.findByInflow(userId, inflow.id);
  const latest = inflow.accountId ? await repos.balances.latest(userId, inflow.accountId) : null;
  if (!entry || latest?.id !== entry.id)
    return err(
      new ConflictError(
        'inflow_not_latest',
        'Newer balances exist on the account; this inflow can no longer change',
      ),
    );
  return ok(entry);
}

/** credited / amount for a cross-currency credit, else null. */
export function realisedRateOf(
  row: InflowRow,
  registry: CurrencyLookup,
  accountCurrency: string | null,
): string | null {
  if (row.creditedAmount === null || accountCurrency === null || accountCurrency === row.currency)
    return null;
  const own = registry.get(row.currency);
  const target = registry.get(accountCurrency);
  if (own.isErr() || target.isErr()) return null;
  return deriveInflowCredit({
    amount: Money.of(row.amount, own.value),
    accountCurrency: target.value,
    creditedAmount: Money.of(row.creditedAmount, target.value),
  })
    .map((d) => d.realisedRate?.toFixed() ?? null)
    .unwrapOr(null);
}
