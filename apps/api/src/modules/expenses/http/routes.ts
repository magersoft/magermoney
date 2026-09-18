import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
  ExpenseCategoryDtoSchema,
  ExpenseCategoryInputSchema,
  ExpenseDtoSchema,
  ExpenseInputSchema,
  IdParamSchema,
  UpdateExpenseCategoryInputSchema,
  UpdateExpenseInputSchema,
} from '@magermoney/contracts';
import type { AppDeps, AppEnv } from '../../../app.js';
import { requireUser } from '../../../shared/auth/middleware.js';
import { ERRORS, fail } from '../../accounts/http/routes.js';
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '../application/categories.js';
import { deleteExpense } from '../application/delete-expense.js';
import { listExpenses } from '../application/list-expenses.js';
import { createExpense, updateExpense, type ExpenseDeps } from '../application/save-expense.js';

const json = (schema: z.ZodTypeAny, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});
const body = <S extends z.ZodTypeAny>(schema: S) => ({
  content: { 'application/json': { schema } },
});

export function expenseRoutes(deps: AppDeps) {
  const r = new OpenAPIHono<AppEnv>();
  const uc: ExpenseDeps = {
    uow: deps.uow,
    repos: deps.repos,
    registry: deps.registry,
    clock: deps.clock,
  };
  const guard = requireUser({ jwks: deps.jwks, secret: deps.jwtSecret });
  r.use('/expense-categories', guard);
  r.use('/expense-categories/*', guard);
  r.use('/expenses', guard);
  r.use('/expenses/*', guard);

  r.openapi(
    createRoute({
      method: 'get',
      path: '/expense-categories',
      security: [{ bearer: [] }],
      responses: { 200: json(z.array(ExpenseCategoryDtoSchema), 'By sort order'), ...ERRORS },
    }),
    async (c) => c.json(await listCategories(deps.repos)(c.var.userId), 200),
  );
  r.openapi(
    createRoute({
      method: 'post',
      path: '/expense-categories',
      security: [{ bearer: [] }],
      request: { body: body(ExpenseCategoryInputSchema) },
      responses: { 201: json(ExpenseCategoryDtoSchema, 'Created'), ...ERRORS },
    }),
    async (c) =>
      (await createCategory(deps.repos)(c.var.userId, c.req.valid('json'))).match(
        (dto) => c.json(dto, 201),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'patch',
      path: '/expense-categories/{id}',
      security: [{ bearer: [] }],
      request: { params: IdParamSchema, body: body(UpdateExpenseCategoryInputSchema) },
      responses: { 200: json(ExpenseCategoryDtoSchema, 'Updated'), ...ERRORS },
    }),
    async (c) =>
      (
        await updateCategory(deps.repos)(c.var.userId, c.req.valid('param').id, c.req.valid('json'))
      ).match(
        (dto) => c.json(dto, 200),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'delete',
      path: '/expense-categories/{id}',
      security: [{ bearer: [] }],
      request: { params: IdParamSchema },
      responses: { 204: { description: 'Deleted' }, ...ERRORS },
    }),
    async (c) =>
      (await deleteCategory(deps.repos)(c.var.userId, c.req.valid('param').id)).match(
        () => c.body(null, 204),
        (e) => fail(c, e),
      ),
  );

  r.openapi(
    createRoute({
      method: 'get',
      path: '/expenses',
      security: [{ bearer: [] }],
      responses: { 200: json(z.array(ExpenseDtoSchema), 'Including ended expenses'), ...ERRORS },
    }),
    async (c) => c.json(await listExpenses(deps.repos)(c.var.userId), 200),
  );
  r.openapi(
    createRoute({
      method: 'post',
      path: '/expenses',
      security: [{ bearer: [] }],
      request: { body: body(ExpenseInputSchema) },
      responses: { 201: json(ExpenseDtoSchema, 'Created'), ...ERRORS },
    }),
    async (c) =>
      (await createExpense(uc)(c.var.userId, c.req.valid('json'))).match(
        (dto) => c.json(dto, 201),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'patch',
      path: '/expenses/{id}',
      security: [{ bearer: [] }],
      request: { params: IdParamSchema, body: body(UpdateExpenseInputSchema) },
      responses: { 200: json(ExpenseDtoSchema, 'Updated'), ...ERRORS },
    }),
    async (c) =>
      (await updateExpense(uc)(c.var.userId, c.req.valid('param').id, c.req.valid('json'))).match(
        (dto) => c.json(dto, 200),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'delete',
      path: '/expenses/{id}',
      security: [{ bearer: [] }],
      request: { params: IdParamSchema },
      responses: { 204: { description: 'Deleted' }, ...ERRORS },
    }),
    async (c) =>
      (await deleteExpense(deps.repos)(c.var.userId, c.req.valid('param').id)).match(
        () => c.body(null, 204),
        (e) => fail(c, e),
      ),
  );
  return r;
}
