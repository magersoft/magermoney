import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { ErrorDtoSchema, ProfileDtoSchema, UpdateProfileInputSchema } from '@magermoney/contracts';
import type { AppDeps, AppEnv } from '../../../app.js';
import { requireUser } from '../../../shared/auth/middleware.js';
import { toHttpError } from '../../../shared/errors/http.js';
import { getProfile } from '../application/get-profile.js';
import { updateProfile } from '../application/update-profile.js';

const errors = { 400: { description: 'Bad request', content: { 'application/json': { schema: ErrorDtoSchema } } }, 401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorDtoSchema } } }, 404: { description: 'Not found', content: { 'application/json': { schema: ErrorDtoSchema } } } };

export function profileRoutes(deps: AppDeps) {
  const r = new OpenAPIHono<AppEnv>();
  r.use('*', requireUser(deps.jwtSecret));
  r.openapi(createRoute({ method: 'get', path: '/', security: [{ bearer: [] }], responses: { 200: { description: 'Profile', content: { 'application/json': { schema: ProfileDtoSchema } } }, ...errors } }),
    async (c) => { const res = await getProfile(deps.profiles)(c.var.userId); return res.match((p) => c.json(p, 200), (e) => { const h = toHttpError(e); return c.json(h.body, h.status as 404); }); });
  r.openapi(createRoute({ method: 'patch', path: '/', security: [{ bearer: [] }], request: { body: { content: { 'application/json': { schema: UpdateProfileInputSchema } } } }, responses: { 200: { description: 'Updated', content: { 'application/json': { schema: ProfileDtoSchema } } }, ...errors } }),
    async (c) => { const res = await updateProfile(deps.profiles, deps.registry)(c.var.userId, c.req.valid('json')); return res.match((p) => c.json(p, 200), (e) => { const h = toHttpError(e); return c.json(h.body, h.status as 400); }); });
  return r;
}
