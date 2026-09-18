import { err, ok, type Result } from 'neverthrow';
import type { IncomeSourceDto, UpdateIncomeSourceInput } from '@magermoney/contracts';
import { ConflictError, NotFoundError } from '../../../shared/errors/http.js';
import {
  assertDefaultAccount,
  validateSource,
  type IncomeSourceDeps,
  type IncomeSourceFailure,
} from './create-income-source.js';
import { toIncomeSourceDto } from './dto.js';
import type { NewIncomeSource } from './income-source-repository.js';

const pick = <T>(next: T | undefined, current: T): T => (next === undefined ? current : next);

export const updateIncomeSource =
  (deps: IncomeSourceDeps) =>
  (
    userId: string,
    id: string,
    input: UpdateIncomeSourceInput,
  ): Promise<Result<IncomeSourceDto, IncomeSourceFailure>> =>
    deps.uow(async (repos) => {
      // Before the read, so `current.isPrimary` is what the previous claimant committed.
      if (input.isPrimary === true) await repos.incomeSources.lockAll(userId);
      const current = await repos.incomeSources.findById(userId, id);
      if (!current) return err(new NotFoundError('income source'));
      const merged: NewIncomeSource = {
        name: pick(input.name, current.name),
        grossAmount: pick(input.grossAmount, current.grossAmount),
        currency: pick(input.currency, current.currency),
        taxRate: pick(input.taxRate, current.taxRate),
        commissionRate: pick(input.commissionRate, current.commissionRate),
        payDays: pick(input.payDays, current.payDays),
        isPrimary: pick(input.isPrimary, current.isPrimary),
        activeFrom: pick(input.activeFrom, current.activeFrom),
        activeTo: pick(input.activeTo, current.activeTo),
        defaultAccountId: pick(input.defaultAccountId, current.defaultAccountId),
      };
      const data = validateSource(merged, deps.registry);
      if (data.isErr()) return err(data.error);
      // Inflows default to their source's currency and are compared against its net.
      if (
        data.value.currency !== current.currency &&
        (await repos.incomeSources.countInflows(userId, id)) > 0
      )
        return err(
          new ConflictError(
            'source_has_inflows',
            'The currency cannot change once inflows exist; end this source and add a new one',
          ),
        );
      if (data.value.defaultAccountId !== current.defaultAccountId) {
        const account = await assertDefaultAccount(repos, userId, data.value.defaultAccountId);
        if (account.isErr()) return err(account.error);
      }
      if (data.value.isPrimary && !current.isPrimary)
        await repos.incomeSources.clearPrimary(userId);
      const row = await repos.incomeSources.update(userId, id, data.value);
      return row
        ? ok(toIncomeSourceDto(row, deps.registry))
        : err(new NotFoundError('income source'));
    });
