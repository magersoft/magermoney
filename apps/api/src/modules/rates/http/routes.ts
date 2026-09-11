import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { CurrencyDtoSchema, ErrorDtoSchema, RateDtoSchema, RatesQuerySchema } from '@magermoney/contracts';
import type { AppDeps, AppEnv } from '../../../app.js';
import { requireUser } from '../../../shared/auth/middleware.js';
import { getRates } from '../application/get-rates.js';
import { listCurrencies } from '../application/list-currencies.js';

const errors = { 401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorDtoSchema } } } };

export function ratesRoutes(deps: AppDeps) {
  const r = new OpenAPIHono<AppEnv>();
  r.use('/currencies', requireUser(deps.jwtSecret));
  r.use('/rates', requireUser(deps.jwtSecret));

  r.openapi(
    createRoute({ method: 'get', path: '/currencies', security: [{ bearer: [] }], responses: { 200: { description: 'Currencies', content: { 'application/json': { schema: z.array(CurrencyDtoSchema) } } }, ...errors } }),
    async (c) => c.json(await listCurrencies(deps.rates)(), 200),
  );

  r.openapi(
    createRoute({ method: 'get', path: '/rates', security: [{ bearer: [] }], request: { query: RatesQuerySchema }, responses: { 200: { description: 'Rates', content: { 'application/json': { schema: z.array(RateDtoSchema) } } }, ...errors } }),
    async (c) => {
      const { date } = c.req.valid('query');
      const rates = await getRates(deps.rates)(c.var.userId, date ?? deps.clock.today());
      return c.json(rates, 200);
    },
  );

  return r;
}
