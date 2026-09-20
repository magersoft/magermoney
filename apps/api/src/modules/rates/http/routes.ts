import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
  CurrencyDtoSchema,
  DeleteManualRateQuerySchema,
  ErrorDtoSchema,
  ManualRateInputSchema,
  RateDtoSchema,
  RatesQuerySchema,
  RefreshRatesResultSchema,
} from '@magermoney/contracts';
import type { AppDeps, AppEnv } from '../../../app.js';
import { requireUser } from '../../../shared/auth/middleware.js';
import { toHttpError } from '../../../shared/errors/http.js';
import { getRates } from '../application/get-rates.js';
import { listCurrencies } from '../application/list-currencies.js';
import { removeManualRate } from '../application/remove-manual-rate.js';
import { setManualRate } from '../application/set-manual-rate.js';
import { refreshRates } from '../application/refresh-rates.js';

const errors = {
  401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorDtoSchema } } },
};
const errorsWith400 = {
  400: { description: 'Bad request', content: { 'application/json': { schema: ErrorDtoSchema } } },
  ...errors,
};

export function ratesRoutes(deps: AppDeps) {
  const r = new OpenAPIHono<AppEnv>();
  r.use('/currencies', requireUser({ jwks: deps.jwks, secret: deps.jwtSecret }));
  r.use('/rates', requireUser({ jwks: deps.jwks, secret: deps.jwtSecret }));
  r.use('/rates/manual', requireUser({ jwks: deps.jwks, secret: deps.jwtSecret }));
  r.use('/rates/refresh', requireUser({ jwks: deps.jwks, secret: deps.jwtSecret }));

  r.openapi(
    createRoute({
      method: 'post',
      path: '/rates/refresh',
      security: [{ bearer: [] }],
      responses: {
        200: {
          description: 'Refreshed, or already fresh',
          content: { 'application/json': { schema: RefreshRatesResultSchema } },
        },
        502: {
          description: 'Provider failed',
          content: { 'application/json': { schema: ErrorDtoSchema } },
        },
        ...errors,
      },
    }),
    async (c) => {
      const res = await refreshRates(deps.rates, deps.rateProviders, deps.clock)();
      return res.match(
        (v) => c.json(v, 200),
        // The provider is the thing that failed, not the request: 502, and the
        // client shows "could not reach the rates service", not a form error.
        (e) => c.json({ code: e.code, message: e.message }, 502),
      );
    },
  );

  r.openapi(
    createRoute({
      method: 'get',
      path: '/currencies',
      security: [{ bearer: [] }],
      responses: {
        200: {
          description: 'Currencies',
          content: { 'application/json': { schema: z.array(CurrencyDtoSchema) } },
        },
        ...errors,
      },
    }),
    async (c) => c.json(await listCurrencies(deps.rates)(), 200),
  );

  r.openapi(
    createRoute({
      method: 'get',
      path: '/rates',
      security: [{ bearer: [] }],
      request: { query: RatesQuerySchema },
      responses: {
        200: {
          description: 'Rates',
          content: { 'application/json': { schema: z.array(RateDtoSchema) } },
        },
        ...errors,
      },
    }),
    async (c) => {
      const { date } = c.req.valid('query');
      const rates = await getRates(deps.rates)(c.var.userId, date ?? deps.clock.today());
      return c.json(rates, 200);
    },
  );

  r.openapi(
    createRoute({
      method: 'put',
      path: '/rates/manual',
      security: [{ bearer: [] }],
      request: { body: { content: { 'application/json': { schema: ManualRateInputSchema } } } },
      responses: {
        200: {
          description: 'Manual rate',
          content: { 'application/json': { schema: RateDtoSchema } },
        },
        ...errorsWith400,
      },
    }),
    async (c) => {
      const res = await setManualRate(deps.rates, deps.registry)(c.var.userId, c.req.valid('json'));
      return res.match(
        (rate) => c.json(rate, 200),
        (e) => {
          const h = toHttpError(e);
          return c.json(h.body, h.status as 400);
        },
      );
    },
  );

  r.openapi(
    createRoute({
      method: 'delete',
      path: '/rates/manual',
      security: [{ bearer: [] }],
      request: { query: DeleteManualRateQuerySchema },
      responses: {
        204: { description: 'Removed' },
        404: {
          description: 'No override',
          content: { 'application/json': { schema: ErrorDtoSchema } },
        },
        ...errors,
      },
    }),
    async (c) =>
      (await removeManualRate(deps.rates)(c.var.userId, c.req.valid('query'))).match(
        () => c.body(null, 204),
        (e) => {
          const h = toHttpError(e);
          return c.json(h.body, h.status as 404);
        },
      ),
  );

  return r;
}
