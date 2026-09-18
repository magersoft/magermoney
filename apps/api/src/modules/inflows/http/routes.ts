import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
  CreateInflowInputSchema,
  IdParamSchema,
  InflowDtoSchema,
  InflowsQuerySchema,
  UpdateInflowInputSchema,
} from '@magermoney/contracts';
import type { AppDeps, AppEnv } from '../../../app.js';
import { requireUser } from '../../../shared/auth/middleware.js';
import { ERRORS, fail } from '../../accounts/http/routes.js';
import { createInflow, type InflowDeps } from '../application/create-inflow.js';
import { deleteInflow } from '../application/delete-inflow.js';
import { listInflows } from '../application/list-inflows.js';
import { updateInflow } from '../application/update-inflow.js';

const json = (schema: z.ZodTypeAny, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});

export function inflowRoutes(deps: AppDeps) {
  const r = new OpenAPIHono<AppEnv>();
  const uc: InflowDeps = {
    uow: deps.uow,
    repos: deps.repos,
    registry: deps.registry,
    clock: deps.clock,
  };
  r.use('/inflows', requireUser({ jwks: deps.jwks, secret: deps.jwtSecret }));
  r.use('/inflows/*', requireUser({ jwks: deps.jwks, secret: deps.jwtSecret }));

  r.openapi(
    createRoute({
      method: 'get',
      path: '/inflows',
      security: [{ bearer: [] }],
      request: { query: InflowsQuerySchema },
      responses: { 200: json(z.array(InflowDtoSchema), 'Newest first'), ...ERRORS },
    }),
    async (c) => c.json(await listInflows(uc)(c.var.userId, c.req.valid('query')), 200),
  );
  r.openapi(
    createRoute({
      method: 'post',
      path: '/inflows',
      security: [{ bearer: [] }],
      request: { body: { content: { 'application/json': { schema: CreateInflowInputSchema } } } },
      responses: { 201: json(InflowDtoSchema, 'Created'), ...ERRORS },
    }),
    async (c) =>
      (await createInflow(uc)(c.var.userId, c.req.valid('json'))).match(
        (dto) => c.json(dto, 201),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'patch',
      path: '/inflows/{id}',
      security: [{ bearer: [] }],
      request: {
        params: IdParamSchema,
        body: { content: { 'application/json': { schema: UpdateInflowInputSchema } } },
      },
      responses: { 200: json(InflowDtoSchema, 'Updated'), ...ERRORS },
    }),
    async (c) =>
      (await updateInflow(uc)(c.var.userId, c.req.valid('param').id, c.req.valid('json'))).match(
        (dto) => c.json(dto, 200),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'delete',
      path: '/inflows/{id}',
      security: [{ bearer: [] }],
      request: { params: IdParamSchema },
      responses: { 204: { description: 'Deleted' }, ...ERRORS },
    }),
    async (c) =>
      (await deleteInflow(uc)(c.var.userId, c.req.valid('param').id)).match(
        () => c.body(null, 204),
        (e) => fail(c, e),
      ),
  );
  return r;
}
