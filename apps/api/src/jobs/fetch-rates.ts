import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { ErrorDtoSchema } from '@magermoney/contracts';
import type { AppDeps, AppEnv } from '../app.js';
import { fetchRates } from '../modules/rates/application/fetch-rates.js';

const StoredDtoSchema = z.object({ stored: z.number().int().min(0) }).openapi('JobResult');

export function jobRoutes(deps: AppDeps) {
  const r = new OpenAPIHono<AppEnv>();

  r.openapi(
    createRoute({
      method: 'post',
      path: '/jobs/rates',
      security: [{ bearer: [] }],
      request: { query: z.object({ kind: z.enum(['fiat', 'crypto']) }) },
      responses: {
        200: { description: 'Fetched', content: { 'application/json': { schema: StoredDtoSchema } } },
        401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorDtoSchema } } },
        502: { description: 'Provider failed', content: { 'application/json': { schema: ErrorDtoSchema } } },
      },
    }),
    async (c) => {
      const header = c.req.header('authorization') ?? '';
      if (header !== `Bearer ${deps.cronSecret}`) return c.json({ code: 'UNAUTHORIZED', message: 'Sign in required' }, 401);
      const { kind } = c.req.valid('query');
      const res = await fetchRates(deps.rates, deps.rateProviders, deps.registry, deps.clock)(kind);
      return res.match(
        (v) => c.json(v, 200),
        (e) => c.json({ code: 'PROVIDER_FAILED', message: e.message }, 502),
      );
    },
  );

  return r;
}
