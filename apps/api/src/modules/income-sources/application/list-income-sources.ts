import type { IncomeSourceDto } from '@magermoney/contracts';
import type { IncomeSourceDeps } from './create-income-source.js';
import { toIncomeSourceDto } from './dto.js';

/** Ended sources are included: history keeps referring to them. */
export const listIncomeSources =
  (deps: IncomeSourceDeps) =>
  async (userId: string): Promise<IncomeSourceDto[]> =>
    (await deps.repos.incomeSources.list(userId)).map((r) => toIncomeSourceDto(r, deps.registry));
