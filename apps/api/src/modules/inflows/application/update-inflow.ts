import { err, ok, type Result } from 'neverthrow';
import { Decimal, Money } from '@magermoney/domain';
import type { InflowDto, UpdateInflowInput } from '@magermoney/contracts';
import { NotFoundError } from '../../../shared/errors/http.js';
import {
  creditedWithoutAccount,
  resolveInflow,
  type InflowDeps,
  type InflowFailure,
} from './create-inflow.js';
import {
  assertInflowLatest,
  freshTarget,
  planCredit,
  revertedTarget,
  writeCredit,
  type CreditPlan,
} from './credit.js';
import { toInflowDto } from './dto.js';

const pick = <T>(next: T | undefined, current: T): T => (next === undefined ? current : next);

export const updateInflow =
  (deps: InflowDeps) =>
  (
    userId: string,
    id: string,
    input: UpdateInflowInput,
  ): Promise<Result<InflowDto, InflowFailure>> =>
    // Every check runs before the first write: an `err` returned from a unit of work does not roll it back.
    deps.uow(async (repos) => {
      // Learn the accounts before locking; the row read after the lock is what everything below uses.
      const existing = await repos.inflows.findById(userId, id);
      if (!existing) return err(new NotFoundError('inflow'));
      const targetId = input.accountId === undefined ? existing.accountId : input.accountId;
      const ids = [
        ...new Set([existing.accountId, targetId].filter((x): x is string => x !== null)),
      ];
      const locked = ids.length > 0 ? await repos.accounts.lock(userId, ids) : [];
      const current = await repos.inflows.findById(userId, id);
      if (!current || current.accountId !== existing.accountId)
        return err(new NotFoundError('inflow'));

      if (targetId === null && input.creditedAmount != null) return err(creditedWithoutAccount());
      const resolved = await resolveInflow(deps, repos, userId, {
        incomeSourceId: pick(input.incomeSourceId, current.incomeSourceId),
        amount: pick(input.amount, current.amount),
        // An inflow keeps its own currency when it moves to another source.
        currency: pick(input.currency, current.currency),
        receivedOn: pick(input.receivedOn, current.receivedOn),
        realisedRateToUsd: pick(input.realisedRateToUsd, current.realisedRateToUsd),
        note: pick(input.note, current.note),
      });
      if (resolved.isErr()) return err(resolved.error);
      const { data, currency } = resolved.value;

      if (current.accountId !== null) {
        const latest = await assertInflowLatest(repos, userId, current);
        if (latest.isErr()) return err(latest.error);
      }

      let plan: CreditPlan | null = null;
      if (targetId !== null) {
        const account = locked.find((a) => a.id === targetId);
        if (!account) return err(new NotFoundError('account'));
        const sameAccount = targetId === current.accountId;
        const target = sameAccount
          ? await revertedTarget(deps.registry, repos, userId, account, current)
          : freshTarget(deps.registry, account);
        if (target.isErr()) return err(target.error);
        // The stored credited amount still describes this inflow only if neither the money nor the account changed.
        const moneyUnchanged =
          sameAccount &&
          data.currency === current.currency &&
          new Decimal(data.amount).eq(current.amount);
        const planned = planCredit({
          target: target.value,
          amount: Money.of(data.amount, currency),
          creditedAmount:
            input.creditedAmount ??
            (moneyUnchanged ? (current.creditedAmount ?? undefined) : undefined),
          receivedOn: data.receivedOn,
          clock: deps.clock,
        });
        if (planned.isErr()) return err(planned.error);
        plan = planned.value;
      }

      // Revert, rewrite, re-apply.
      if (current.accountId !== null) await repos.balances.deleteByInflow(userId, id);
      const row = await repos.inflows.update(userId, id, {
        ...data,
        accountId: plan?.accountId ?? null,
        creditedAmount: plan?.credited.toString() ?? null,
      });
      if (!row) return err(new NotFoundError('inflow'));
      if (plan) await writeCredit(repos, userId, id, plan);
      return ok(toInflowDto(row, plan?.realisedRate?.toFixed() ?? null));
    });
