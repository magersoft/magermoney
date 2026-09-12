import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
  AccountDtoSchema,
  CreateAccountInputSchema,
  ErrorDtoSchema,
  IdParamSchema,
  ReorderAccountsInputSchema,
  UpdateAccountInputSchema,
} from '@magermoney/contracts';
import type { Context } from 'hono';
import type { AppDeps, AppEnv } from '../../../app.js';
import { requireUser } from '../../../shared/auth/middleware.js';
import { toHttpError, type AppError } from '../../../shared/errors/http.js';
import { setAccountArchived } from '../application/archive-account.js';
import { createAccount, type AccountDeps } from '../application/create-account.js';
import { deleteAccount } from '../application/delete-account.js';
import { listAccounts } from '../application/list-accounts.js';
import { reorderAccounts } from '../application/reorder-accounts.js';
import { updateAccount } from '../application/update-account.js';

const errorContent = { content: { 'application/json': { schema: ErrorDtoSchema } } };
export const ERRORS = {
  400: { description: 'Bad request', ...errorContent },
  401: { description: 'Unauthorized', ...errorContent },
  404: { description: 'Not found', ...errorContent },
  409: { description: 'Conflict', ...errorContent },
};
const json = (schema: z.ZodTypeAny, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});

/** One place turns a use-case error into a response; the status is narrowed for hono's typed responses. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fail(c: Context<AppEnv>, e: AppError): any {
  const h = toHttpError(e);
  return c.json(h.body, h.status as 400);
}

export function accountRoutes(deps: AppDeps) {
  const r = new OpenAPIHono<AppEnv>();
  const uc: AccountDeps = { repos: deps.repos, registry: deps.registry, clock: deps.clock };
  r.use('/accounts', requireUser({ jwks: deps.jwks, secret: deps.jwtSecret }));
  r.use('/accounts/*', requireUser({ jwks: deps.jwks, secret: deps.jwtSecret }));
  r.use('/balances/*', requireUser({ jwks: deps.jwks, secret: deps.jwtSecret }));

  r.openapi(
    createRoute({
      method: 'get',
      path: '/accounts',
      security: [{ bearer: [] }],
      responses: {
        200: json(z.array(AccountDtoSchema), 'Accounts with their latest balance'),
        401: ERRORS[401],
      },
    }),
    async (c) => c.json(await listAccounts(deps.repos)(c.var.userId), 200),
  );

  r.openapi(
    createRoute({
      method: 'post',
      path: '/accounts',
      security: [{ bearer: [] }],
      request: { body: { content: { 'application/json': { schema: CreateAccountInputSchema } } } },
      responses: { 201: json(AccountDtoSchema, 'Created'), 400: ERRORS[400], 401: ERRORS[401] },
    }),
    async (c) =>
      (await createAccount(uc)(c.var.userId, c.req.valid('json'))).match(
        (dto) => c.json(dto, 201),
        (e) => fail(c, e),
      ),
  );

  // Registered before `/accounts/:id` so "order" is never read as an id.
  r.openapi(
    createRoute({
      method: 'patch',
      path: '/accounts/order',
      security: [{ bearer: [] }],
      request: {
        body: { content: { 'application/json': { schema: ReorderAccountsInputSchema } } },
      },
      responses: { 204: { description: 'Reordered' }, 400: ERRORS[400], 401: ERRORS[401] },
    }),
    async (c) =>
      (await reorderAccounts(uc)(c.var.userId, c.req.valid('json').ids)).match(
        () => c.body(null, 204),
        (e) => fail(c, e),
      ),
  );

  r.openapi(
    createRoute({
      method: 'patch',
      path: '/accounts/{id}',
      security: [{ bearer: [] }],
      request: {
        params: IdParamSchema,
        body: { content: { 'application/json': { schema: UpdateAccountInputSchema } } },
      },
      responses: { 200: json(AccountDtoSchema, 'Updated'), ...ERRORS },
    }),
    async (c) =>
      (await updateAccount(uc)(c.var.userId, c.req.valid('param').id, c.req.valid('json'))).match(
        (dto) => c.json(dto, 200),
        (e) => fail(c, e),
      ),
  );

  for (const [action, archived] of [
    ['archive', true],
    ['unarchive', false],
  ] as const) {
    r.openapi(
      createRoute({
        method: 'post',
        path: `/accounts/{id}/${action}`,
        security: [{ bearer: [] }],
        request: { params: IdParamSchema },
        responses: { 200: json(AccountDtoSchema, action), 401: ERRORS[401], 404: ERRORS[404] },
      }),
      async (c) =>
        (await setAccountArchived(uc)(c.var.userId, c.req.valid('param').id, archived)).match(
          (dto) => c.json(dto, 200),
          (e) => fail(c, e),
        ),
    );
  }

  r.openapi(
    createRoute({
      method: 'delete',
      path: '/accounts/{id}',
      security: [{ bearer: [] }],
      request: { params: IdParamSchema },
      responses: {
        204: { description: 'Deleted' },
        401: ERRORS[401],
        404: ERRORS[404],
        409: ERRORS[409],
      },
    }),
    async (c) =>
      (await deleteAccount(uc)(c.var.userId, c.req.valid('param').id)).match(
        () => c.body(null, 204),
        (e) => fail(c, e),
      ),
  );

  return r;
}
