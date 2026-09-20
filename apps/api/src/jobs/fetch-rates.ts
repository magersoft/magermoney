import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { RouteHandler } from '@hono/zod-openapi';
import { ErrorDtoSchema } from '@magermoney/contracts';
import type { AppDeps, AppEnv } from '../app.js';
import { fetchRates } from '../modules/rates/application/fetch-rates.js';

const StoredDtoSchema = z.object({ stored: z.number().int().min(0) }).openapi('JobResult');

// Vercel Cron invokes the path with GET and `Authorization: Bearer $CRON_SECRET`.
// POST stays for manual triggers (curl, the e2e seed step).
const jobRoute = (method: 'get' | 'post') =>
  createRoute({
    method,
    path: '/jobs/rates',
    security: [{ cronSecret: [] }],
    request: { query: z.object({ kind: z.enum(['fiat', 'crypto']) }) },
    responses: {
      200: {
        description: 'Fetched',
        content: { 'application/json': { schema: StoredDtoSchema } },
      },
      401: {
        description: 'Unauthorized',
        content: { 'application/json': { schema: ErrorDtoSchema } },
      },
      502: {
        description: 'Provider failed',
        content: { 'application/json': { schema: ErrorDtoSchema } },
      },
    },
  });

export function jobRoutes(deps: AppDeps) {
  const r = new OpenAPIHono<AppEnv>();

  const handler: RouteHandler<ReturnType<typeof jobRoute>, AppEnv> = async (c) => {
    const header = c.req.header('authorization') ?? '';
    if (header !== `Bearer ${deps.cronSecret}`)
      return c.json({ code: 'UNAUTHORIZED', message: 'Sign in required' }, 401);
    const { kind } = c.req.valid('query');
    const res = await fetchRates(deps.rates, deps.rateProviders, deps.clock)(kind);
    return res.match(
      (v) => c.json(v, 200),
      (e) => c.json({ code: 'PROVIDER_FAILED', message: e.message }, 502),
    );
  };

  r.openapi(jobRoute('get'), handler);
  r.openapi(jobRoute('post'), handler);

  return r;
}
