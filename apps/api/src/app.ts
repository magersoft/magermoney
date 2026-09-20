import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import type { JWTVerifyGetKey } from 'jose';
import type { Clock, CurrencyLookup } from '@magermoney/domain';
import { mountOpenApi } from './shared/openapi.js';
import { logger } from './shared/logger.js';
import { profileRoutes } from './modules/profiles/http/routes.js';
import type { ProfileRepository } from './modules/profiles/application/profile-repository.js';
import { ratesRoutes } from './modules/rates/http/routes.js';
import { accountRoutes } from './modules/accounts/http/routes.js';
import { transferRoutes } from './modules/transfers/http/routes.js';
import { incomeSourceRoutes } from './modules/income-sources/http/routes.js';
import type { IncomeSourceRepository } from './modules/income-sources/application/income-source-repository.js';
import { inflowRoutes } from './modules/inflows/http/routes.js';
import type { InflowRepository } from './modules/inflows/application/inflow-repository.js';
import { expenseRoutes } from './modules/expenses/http/routes.js';
import type { ExpenseCategoryRepository } from './modules/expenses/application/category-repository.js';
import type { ExpenseRepository } from './modules/expenses/application/expense-repository.js';
import { budgetRoutes } from './modules/budgets/http/routes.js';
import type { BudgetRepository } from './modules/budgets/application/budget-repository.js';
import type { RateRepository } from './modules/rates/application/rate-repository.js';
import type { RateProvider } from './modules/rates/application/rate-provider.js';
import { jobRoutes } from './jobs/fetch-rates.js';
import type { UnitOfWork } from './shared/db/unit-of-work.js';
import type { AccountRepository } from './modules/accounts/application/account-repository.js';
import type { BalanceRepository } from './modules/accounts/application/balance-repository.js';
import type { TransferRepository } from './modules/transfers/application/transfer-repository.js';

export interface Repos {
  accounts: AccountRepository;
  balances: BalanceRepository;
  transfers: TransferRepository;
  incomeSources: IncomeSourceRepository;
  inflows: InflowRepository;
  expenseCategories: ExpenseCategoryRepository;
  expenses: ExpenseRepository;
  budgets: BudgetRepository;
}

export type AppEnv = { Variables: { userId: string; requestId: string } };

export interface AppDeps {
  clock: Clock;
  /** HS256 fallback secret. Optional: `jwks` alone is enough. */
  jwtSecret?: string | undefined;
  jwks?: JWTVerifyGetKey | undefined;
  cronSecret: string;
  exposeDocs?: boolean | undefined;
  /** Exact origins allowed to send credentialed requests. */
  corsOrigins?: string[] | undefined;
  /** Also allow `https://*.vercel.app` preview deployments. */
  allowVercelPreviews?: boolean | undefined;
  profiles: ProfileRepository;
  /** The currency catalogue. `ready` loads it when it is backed by the database. */
  registry: CurrencyLookup & { ready?(): Promise<void> };
  rates: RateRepository;
  rateProviders: RateProvider[];
  repos: Repos;
  uow: UnitOfWork<Repos>;
}

const VERCEL_PREVIEW = /^https:\/\/[a-z0-9-]+\.vercel\.app$/;

/**
 * `credentials: true` plus a reflected origin lets any site read the API as the
 * signed-in user, so reflect only origins we actually ship.
 */
export function originAllowList(deps: AppDeps): (origin: string) => string | null {
  const allowed = new Set(deps.corsOrigins ?? ['http://localhost:5173']);
  return (origin) => {
    if (allowed.has(origin)) return origin;
    if (deps.allowVercelPreviews && VERCEL_PREVIEW.test(origin)) return origin;
    return null;
  };
}

export function createApp(deps: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success)
        return c.json(
          {
            code: 'VALIDATION',
            message: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          },
          400,
        );
    },
  });
  app.use('*', requestId());
  app.use('*', cors({ origin: originAllowList(deps), credentials: true }));
  /*
   * Every use case reads the currency catalogue synchronously, deep inside a
   * `Result` chain, so it has to be in memory before any handler runs. One
   * query per cold start; a registry built from a literal list has nothing to
   * wait for and skips this.
   */
  app.use('*', async (c, next) => {
    await deps.registry.ready?.();
    await next();
  });
  app.notFound((c) => c.json({ code: 'NOT_FOUND', message: 'Route not found' }, 404));
  app.onError((e, c) => {
    logger.error({ err: e, requestId: c.get('requestId') }, 'unhandled');
    return c.json({ code: 'INTERNAL', message: 'Unexpected error' }, 500);
  });

  app.openapi(
    createRoute({
      method: 'get',
      path: '/health',
      responses: {
        200: {
          description: 'ok',
          content: {
            'application/json': { schema: z.object({ ok: z.boolean(), date: z.string() }) },
          },
        },
      },
    }),
    (c) => c.json({ ok: true, date: deps.clock.today() }, 200),
  );

  app.route('/me', profileRoutes(deps));
  app.route('/', ratesRoutes(deps));
  app.route('/', accountRoutes(deps));
  app.route('/', transferRoutes(deps));
  app.route('/', incomeSourceRoutes(deps));
  app.route('/', inflowRoutes(deps));
  app.route('/', expenseRoutes(deps));
  app.route('/', budgetRoutes(deps));
  app.route('/', jobRoutes(deps));

  mountOpenApi(app, deps.exposeDocs ?? true);
  return app;
}
