import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import type { AppEnv } from '../app.js';

export function mountOpenApi(app: OpenAPIHono<AppEnv>, exposeUi: boolean) {
  app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'Magermoney API', version: '0.1.0' },
  });
  app.openAPIRegistry.registerComponent('securitySchemes', 'bearer', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });
  if (exposeUi) app.get('/docs', swaggerUI({ url: '/openapi.json' }));
}
