import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import type { AppEnv } from '../app.js';

/**
 * The document describes every route and its auth, so it follows the UI: both
 * are off in production.
 */
export function mountOpenApi(app: OpenAPIHono<AppEnv>, exposeDocs: boolean) {
  app.openAPIRegistry.registerComponent('securitySchemes', 'bearer', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });
  app.openAPIRegistry.registerComponent('securitySchemes', 'cronSecret', {
    type: 'apiKey',
    in: 'header',
    name: 'Authorization',
    description: 'Vercel Cron sends `Bearer $CRON_SECRET`. Not a user token.',
  });
  if (!exposeDocs) return;
  app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'Magermoney API', version: '0.1.0' },
  });
  app.get('/docs', swaggerUI({ url: '/openapi.json' }));
}
