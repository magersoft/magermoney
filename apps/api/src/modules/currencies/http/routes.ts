import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
  ConnectCurrencyInputSchema,
  CurrencyCodeParamSchema,
  CurrencyDtoSchema,
  ErrorDtoSchema,
} from '@magermoney/contracts';
import type { AppDeps, AppEnv } from '../../../app.js';
import { requireUser } from '../../../shared/auth/middleware.js';
import { toHttpError } from '../../../shared/errors/http.js';
import { connectCurrency } from '../application/connect.js';
import { disconnectCurrency } from '../application/disconnect.js';
import { listConnected } from '../application/list-connected.js';
import { warmRate } from '../../rates/application/warm-rate.js';

const errors = {
  400: { description: 'Bad request', content: { 'application/json': { schema: ErrorDtoSchema } } },
  401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorDtoSchema } } },
  404: { description: 'Not found', content: { 'application/json': { schema: ErrorDtoSchema } } },
  409: { description: 'Still in use', content: { 'application/json': { schema: ErrorDtoSchema } } },
};

/** Mounted under `/me`: this is the signed-in person's list, not the catalogue. */
export function userCurrencyRoutes(deps: AppDeps) {
  const r = new OpenAPIHono<AppEnv>();
  r.use('*', requireUser({ jwks: deps.jwks, secret: deps.jwtSecret }));

  r.openapi(
    createRoute({
      method: 'get',
      path: '/',
      security: [{ bearer: [] }],
      responses: {
        200: {
          description: 'Connected currencies',
          content: { 'application/json': { schema: z.array(CurrencyDtoSchema) } },
        },
        ...errors,
      },
    }),
    async (c) => c.json(await listConnected(deps.userCurrencies)(c.var.userId), 200),
  );

  r.openapi(
    createRoute({
      method: 'post',
      path: '/',
      security: [{ bearer: [] }],
      request: {
        body: { content: { 'application/json': { schema: ConnectCurrencyInputSchema } } },
      },
      responses: {
        200: {
          description: 'Connected',
          content: { 'application/json': { schema: z.array(CurrencyDtoSchema) } },
        },
        ...errors,
      },
    }),
    async (c) => {
      const { code } = c.req.valid('json');
      const warm = warmRate(deps.rates, deps.rateProviders, deps.clock);
      const res = await connectCurrency(deps.userCurrencies, warm)(c.var.userId, code);
      return res.match(
        async () => c.json(await listConnected(deps.userCurrencies)(c.var.userId), 200),
        async (e) => {
          const h = toHttpError(e);
          return c.json(h.body, h.status as 400);
        },
      );
    },
  );

  r.openapi(
    createRoute({
      method: 'delete',
      path: '/{code}',
      security: [{ bearer: [] }],
      request: { params: CurrencyCodeParamSchema },
      responses: {
        204: { description: 'Disconnected' },
        ...errors,
      },
    }),
    async (c) => {
      const { code } = c.req.valid('param');
      const res = await disconnectCurrency(deps.uow)(c.var.userId, code);
      return res.match(
        () => c.body(null, 204),
        (e) => {
          const h = toHttpError(e);
          return c.json(h.body, h.status as 409);
        },
      );
    },
  );

  return r;
}
