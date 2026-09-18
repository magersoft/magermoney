import type { InflowDto, InflowsQuery } from '@magermoney/contracts';
import type { InflowDeps } from './create-inflow.js';
import { toInflowDto } from './dto.js';

export const listInflows =
  (deps: InflowDeps) =>
  async (userId: string, query: InflowsQuery): Promise<InflowDto[]> =>
    (await deps.repos.inflows.list(userId, query)).map((r) => toInflowDto(r));
