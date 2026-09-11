import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import type { JWTVerifyGetKey } from 'jose';
import type { Clock, CurrencyRegistry } from '@magermoney/domain';
import { mountOpenApi } from './shared/openapi.js';
import { logger } from './shared/logger.js';
import { profileRoutes } from './modules/profiles/http/routes.js';
import type { ProfileRepository } from './modules/profiles/application/profile-repository.js';
import { ratesRoutes } from './modules/rates/http/routes.js';
import type { RateRepository } from './modules/rates/application/rate-repository.js';
import type { RateProvider } from './modules/rates/application/rate-provider.js';
import { jobRoutes } from './jobs/fetch-rates.js';

export type AppEnv = { Variables: { userId: string; requestId: string } };

export interface AppDeps {
  clock: Clock;
  jwtSecret: string;
  jwks?: JWTVerifyGetKey;
  cronSecret: string;
  exposeDocs?: boolean;
  profiles: ProfileRepository;
  registry: CurrencyRegistry;
  rates: RateRepository;
  rateProviders: RateProvider[];
}

export function createApp(deps: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success)
        return c.json(
          {
            code: 'VALIDATION',
            message: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          },
          400,
        );
    },
  });
  app.use('*', requestId());
  app.use('*', cors({ origin: (o) => o, credentials: true }));
  app.notFound((c) => c.json({ code: 'NOT_FOUND', message: 'Route not found' }, 404));
  app.onError((e, c) => {
    logger.error({ err: e, requestId: c.get('requestId') }, 'unhandled');
    return c.json({ code: 'INTERNAL', message: 'Unexpected error' }, 500);
  });

  app.openapi(
    createRoute({
      method: 'get',
      path: '/health',
      responses: {
        200: {
          description: 'ok',
          content: {
            'application/json': { schema: z.object({ ok: z.boolean(), date: z.string() }) },
          },
        },
      },
    }),
    (c) => c.json({ ok: true, date: deps.clock.today() }, 200),
  );

  app.route('/me', profileRoutes(deps));
  app.route('/', ratesRoutes(deps));
  app.route('/', jobRoutes(deps));

  mountOpenApi(app, deps.exposeDocs ?? true);
  return app;
}
