import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
  CreateTransferInputSchema,
  IdParamSchema,
  TransferDtoSchema,
  TransfersQuerySchema,
  UpdateTransferInputSchema,
} from '@magermoney/contracts';
import type { AppDeps, AppEnv } from '../../../app.js';
import { requireUser } from '../../../shared/auth/middleware.js';
import { ERRORS, fail } from '../../accounts/http/routes.js';
import { createTransfer, type TransferDeps } from '../application/create-transfer.js';
import { deleteTransfer } from '../application/delete-transfer.js';
import { listTransfers } from '../application/list-transfers.js';
import { updateTransfer } from '../application/update-transfer.js';

const json = (schema: z.ZodTypeAny, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});

export function transferRoutes(deps: AppDeps) {
  const r = new OpenAPIHono<AppEnv>();
  const uc: TransferDeps = {
    uow: deps.uow,
    repos: deps.repos,
    registry: deps.registry,
    clock: deps.clock,
  };
  r.use('/transfers', requireUser({ jwks: deps.jwks, secret: deps.jwtSecret }));
  r.use('/transfers/*', requireUser({ jwks: deps.jwks, secret: deps.jwtSecret }));

  r.openapi(
    createRoute({
      method: 'get',
      path: '/transfers',
      security: [{ bearer: [] }],
      request: { query: TransfersQuerySchema },
      responses: { 200: json(z.array(TransferDtoSchema), 'Newest first'), ...ERRORS },
    }),
    async (c) => c.json(await listTransfers(uc)(c.var.userId, c.req.valid('query')), 200),
  );
  r.openapi(
    createRoute({
      method: 'post',
      path: '/transfers',
      security: [{ bearer: [] }],
      request: { body: { content: { 'application/json': { schema: CreateTransferInputSchema } } } },
      responses: { 201: json(TransferDtoSchema, 'Created'), ...ERRORS },
    }),
    async (c) =>
      (await createTransfer(uc)(c.var.userId, c.req.valid('json'))).match(
        (dto) => c.json(dto, 201),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'patch',
      path: '/transfers/{id}',
      security: [{ bearer: [] }],
      request: {
        params: IdParamSchema,
        body: { content: { 'application/json': { schema: UpdateTransferInputSchema } } },
      },
      responses: { 200: json(TransferDtoSchema, 'Updated'), ...ERRORS },
    }),
    async (c) =>
      (await updateTransfer(uc)(c.var.userId, c.req.valid('param').id, c.req.valid('json'))).match(
        (dto) => c.json(dto, 200),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'delete',
      path: '/transfers/{id}',
      security: [{ bearer: [] }],
      request: { params: IdParamSchema },
      responses: { 204: { description: 'Deleted' }, ...ERRORS },
    }),
    async (c) =>
      (await deleteTransfer(uc)(c.var.userId, c.req.valid('param').id)).match(
        () => c.body(null, 204),
        (e) => fail(c, e),
      ),
  );
  return r;
}
