import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '../../src/app.js';
import { signTestToken } from './token.js';

export const UID = '11111111-1111-4111-8111-111111111111';
export const OTHER = '22222222-2222-4222-8222-222222222222';
export const SECRET = 'test-secret-test-secret-test-secret-1234';

export async function authed(
  app: OpenAPIHono<AppEnv>,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  uid = UID,
): Promise<Response> {
  return app.request(path, {
    method,
    headers: {
      authorization: `Bearer ${await signTestToken(uid, SECRET)}`,
      'content-type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
