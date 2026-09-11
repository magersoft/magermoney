import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../../app.js';
import { toHttpError, UnauthorizedError } from '../errors/http.js';
import { verifySupabaseJwt, type VerifySupabaseJwtOptions } from './jwt.js';

export const requireUser =
  (opts: VerifySupabaseJwtOptions): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const header = c.req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const verified = token ? await verifySupabaseJwt(token, opts) : undefined;
    if (!verified || verified.isErr()) {
      const { status, body } = toHttpError(new UnauthorizedError());
      return c.json(body, status);
    }
    c.set('userId', verified.value.userId);
    await next();
  };
