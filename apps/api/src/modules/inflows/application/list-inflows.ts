import type { InflowDto, InflowsQuery } from '@magermoney/contracts';
import type { InflowDeps } from './create-inflow.js';
import { realisedRateOf } from './credit.js';
import { toInflowDto } from './dto.js';

export const listInflows =
  (deps: InflowDeps) =>
  async (userId: string, query: InflowsQuery): Promise<InflowDto[]> => {
    const [rows, accounts] = await Promise.all([
      deps.repos.inflows.list(userId, query),
      deps.repos.accounts.list(userId),
    ]);
    const currencyOf = new Map(accounts.map((a) => [a.id, a.currency]));
    return rows.map((r) =>
      toInflowDto(
        r,
        realisedRateOf(
          r,
          deps.registry,
          r.accountId ? (currencyOf.get(r.accountId) ?? null) : null,
        ),
      ),
    );
  };
