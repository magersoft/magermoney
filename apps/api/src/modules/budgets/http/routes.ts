import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
  BudgetDtoSchema,
  BudgetInputSchema,
  IdParamSchema,
  UpdateBudgetInputSchema,
} from '@magermoney/contracts';
import type { AppDeps, AppEnv } from '../../../app.js';
import { requireUser } from '../../../shared/auth/middleware.js';
import { ERRORS, fail } from '../../accounts/http/routes.js';
import {
  createBudget,
  deleteBudget,
  listBudgets,
  updateBudget,
  type BudgetDeps,
} from '../application/budgets.js';

const json = (schema: z.ZodTypeAny, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});
const body = <S extends z.ZodTypeAny>(schema: S) => ({
  content: { 'application/json': { schema } },
});

export function budgetRoutes(deps: AppDeps) {
  const r = new OpenAPIHono<AppEnv>();
  const uc: BudgetDeps = { repos: deps.repos, registry: deps.registry, clock: deps.clock };
  const guard = requireUser({ jwks: deps.jwks, secret: deps.jwtSecret });
  r.use('/budgets', guard);
  r.use('/budgets/*', guard);

  r.openapi(
    createRoute({
      method: 'get',
      path: '/budgets',
      security: [{ bearer: [] }],
      responses: { 200: json(z.array(BudgetDtoSchema), 'Including ended budgets'), ...ERRORS },
    }),
    async (c) => c.json(await listBudgets(uc)(c.var.userId), 200),
  );
  r.openapi(
    createRoute({
      method: 'post',
      path: '/budgets',
      security: [{ bearer: [] }],
      request: { body: body(BudgetInputSchema) },
      responses: { 201: json(BudgetDtoSchema, 'Created'), ...ERRORS },
    }),
    async (c) =>
      (await createBudget(uc)(c.var.userId, c.req.valid('json'))).match(
        (dto) => c.json(dto, 201),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'patch',
      path: '/budgets/{id}',
      security: [{ bearer: [] }],
      request: { params: IdParamSchema, body: body(UpdateBudgetInputSchema) },
      responses: { 200: json(BudgetDtoSchema, 'Updated'), ...ERRORS },
    }),
    async (c) =>
      (await updateBudget(uc)(c.var.userId, c.req.valid('param').id, c.req.valid('json'))).match(
        (dto) => c.json(dto, 200),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'delete',
      path: '/budgets/{id}',
      security: [{ bearer: [] }],
      request: { params: IdParamSchema },
      responses: { 204: { description: 'Deleted' }, ...ERRORS },
    }),
    async (c) =>
      (await deleteBudget(uc)(c.var.userId, c.req.valid('param').id)).match(
        () => c.body(null, 204),
        (e) => fail(c, e),
      ),
  );
  return r;
}
