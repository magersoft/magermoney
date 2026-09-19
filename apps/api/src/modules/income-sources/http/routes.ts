import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
  IdParamSchema,
  IncomeSourceDtoSchema,
  IncomeSourceInputSchema,
  UpdateIncomeSourceInputSchema,
} from '@magermoney/contracts';
import type { AppDeps, AppEnv } from '../../../app.js';
import { requireUser } from '../../../shared/auth/middleware.js';
import { ERRORS, fail } from '../../accounts/http/routes.js';
import { createIncomeSource, type IncomeSourceDeps } from '../application/create-income-source.js';
import { deleteIncomeSource } from '../application/delete-income-source.js';
import { listIncomeSources } from '../application/list-income-sources.js';
import { updateIncomeSource } from '../application/update-income-source.js';

const json = (schema: z.ZodTypeAny, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});

export function incomeSourceRoutes(deps: AppDeps) {
  const r = new OpenAPIHono<AppEnv>();
  const uc: IncomeSourceDeps = {
    uow: deps.uow,
    repos: deps.repos,
    registry: deps.registry,
    clock: deps.clock,
  };
  r.use('/income-sources', requireUser({ jwks: deps.jwks, secret: deps.jwtSecret }));
  r.use('/income-sources/*', requireUser({ jwks: deps.jwks, secret: deps.jwtSecret }));

  r.openapi(
    createRoute({
      method: 'get',
      path: '/income-sources',
      security: [{ bearer: [] }],
      responses: {
        200: json(
          z.array(IncomeSourceDtoSchema),
          'Every source, ended ones included, with its monthly net',
        ),
        ...ERRORS,
      },
    }),
    async (c) => c.json(await listIncomeSources(uc)(c.var.userId), 200),
  );
  r.openapi(
    createRoute({
      method: 'post',
      path: '/income-sources',
      security: [{ bearer: [] }],
      request: { body: { content: { 'application/json': { schema: IncomeSourceInputSchema } } } },
      responses: { 201: json(IncomeSourceDtoSchema, 'Created'), ...ERRORS },
    }),
    async (c) =>
      (await createIncomeSource(uc)(c.var.userId, c.req.valid('json'))).match(
        (dto) => c.json(dto, 201),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'patch',
      path: '/income-sources/{id}',
      security: [{ bearer: [] }],
      request: {
        params: IdParamSchema,
        body: { content: { 'application/json': { schema: UpdateIncomeSourceInputSchema } } },
      },
      responses: { 200: json(IncomeSourceDtoSchema, 'Updated'), ...ERRORS },
    }),
    async (c) =>
      (
        await updateIncomeSource(uc)(c.var.userId, c.req.valid('param').id, c.req.valid('json'))
      ).match(
        (dto) => c.json(dto, 200),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'delete',
      path: '/income-sources/{id}',
      security: [{ bearer: [] }],
      request: { params: IdParamSchema },
      responses: { 204: { description: 'Deleted' }, ...ERRORS },
    }),
    async (c) =>
      (await deleteIncomeSource(uc)(c.var.userId, c.req.valid('param').id)).match(
        () => c.body(null, 204),
        (e) => fail(c, e),
      ),
  );
  return r;
}
