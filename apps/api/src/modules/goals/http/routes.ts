import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
  GoalDtoSchema,
  GoalInputSchema,
  IdParamSchema,
  UpdateGoalInputSchema,
} from '@magermoney/contracts';
import type { AppDeps, AppEnv } from '../../../app.js';
import { requireUser } from '../../../shared/auth/middleware.js';
import { ERRORS, fail } from '../../accounts/http/routes.js';
import {
  createGoal,
  deleteGoal,
  listGoals,
  updateGoal,
  type GoalDeps,
} from '../application/goals.js';

const json = (schema: z.ZodTypeAny, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});
const body = <S extends z.ZodTypeAny>(schema: S) => ({
  content: { 'application/json': { schema } },
});

export function goalRoutes(deps: AppDeps) {
  const r = new OpenAPIHono<AppEnv>();
  const uc: GoalDeps = { repos: deps.repos, registry: deps.registry };
  const guard = requireUser({ jwks: deps.jwks, secret: deps.jwtSecret });
  r.use('/goals', guard);
  r.use('/goals/*', guard);

  r.openapi(
    createRoute({
      method: 'get',
      path: '/goals',
      security: [{ bearer: [] }],
      responses: { 200: json(z.array(GoalDtoSchema), 'Including archived goals'), ...ERRORS },
    }),
    async (c) => c.json(await listGoals(uc)(c.var.userId), 200),
  );
  r.openapi(
    createRoute({
      method: 'post',
      path: '/goals',
      security: [{ bearer: [] }],
      request: { body: body(GoalInputSchema) },
      responses: { 201: json(GoalDtoSchema, 'Created'), ...ERRORS },
    }),
    async (c) =>
      (await createGoal(uc)(c.var.userId, c.req.valid('json'))).match(
        (dto) => c.json(dto, 201),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'patch',
      path: '/goals/{id}',
      security: [{ bearer: [] }],
      request: { params: IdParamSchema, body: body(UpdateGoalInputSchema) },
      responses: { 200: json(GoalDtoSchema, 'Updated'), ...ERRORS },
    }),
    async (c) =>
      (await updateGoal(uc)(c.var.userId, c.req.valid('param').id, c.req.valid('json'))).match(
        (dto) => c.json(dto, 200),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'delete',
      path: '/goals/{id}',
      security: [{ bearer: [] }],
      request: { params: IdParamSchema },
      responses: { 204: { description: 'Deleted' }, ...ERRORS },
    }),
    async (c) =>
      (await deleteGoal(uc)(c.var.userId, c.req.valid('param').id)).match(
        () => c.body(null, 204),
        (e) => fail(c, e),
      ),
  );
  return r;
}
