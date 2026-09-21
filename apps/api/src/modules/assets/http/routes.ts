import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
  AssetDtoSchema,
  AssetInputSchema,
  IdParamSchema,
  UpdateAssetInputSchema,
  UpdateValuationInputSchema,
  ValuationDtoSchema,
  ValuationInputSchema,
} from '@magermoney/contracts';
import type { AppDeps, AppEnv } from '../../../app.js';
import { requireUser } from '../../../shared/auth/middleware.js';
import { ERRORS, fail } from '../../accounts/http/routes.js';
import {
  createAsset,
  deleteAsset,
  listAssets,
  updateAsset,
  type AssetDeps,
} from '../application/assets.js';
import {
  addValuation,
  deleteValuation,
  listValuations,
  updateValuation,
  type ValuationDeps,
} from '../application/valuations.js';

const json = (schema: z.ZodTypeAny, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});
const body = <S extends z.ZodTypeAny>(schema: S) => ({
  content: { 'application/json': { schema } },
});
const AssetIdParamSchema = z.object({ assetId: z.uuid() });

export function assetRoutes(deps: AppDeps) {
  const r = new OpenAPIHono<AppEnv>();
  const uc: AssetDeps = { repos: deps.repos, registry: deps.registry };
  const vc: ValuationDeps = { repos: deps.repos, clock: deps.clock };
  const guard = requireUser({ jwks: deps.jwks, secret: deps.jwtSecret });
  r.use('/assets', guard);
  r.use('/assets/*', guard);
  r.use('/valuations/*', guard);

  r.openapi(
    createRoute({
      method: 'get',
      path: '/assets',
      security: [{ bearer: [] }],
      responses: { 200: json(z.array(AssetDtoSchema), 'Including archived assets'), ...ERRORS },
    }),
    async (c) => c.json(await listAssets(uc)(c.var.userId), 200),
  );
  r.openapi(
    createRoute({
      method: 'post',
      path: '/assets',
      security: [{ bearer: [] }],
      request: { body: body(AssetInputSchema) },
      responses: { 201: json(AssetDtoSchema, 'Created'), ...ERRORS },
    }),
    async (c) =>
      (await createAsset(uc)(c.var.userId, c.req.valid('json'))).match(
        (dto) => c.json(dto, 201),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'patch',
      path: '/assets/{id}',
      security: [{ bearer: [] }],
      request: { params: IdParamSchema, body: body(UpdateAssetInputSchema) },
      responses: { 200: json(AssetDtoSchema, 'Updated'), ...ERRORS },
    }),
    async (c) =>
      (await updateAsset(uc)(c.var.userId, c.req.valid('param').id, c.req.valid('json'))).match(
        (dto) => c.json(dto, 200),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'delete',
      path: '/assets/{id}',
      security: [{ bearer: [] }],
      request: { params: IdParamSchema },
      responses: { 204: { description: 'Deleted, with its valuations' }, ...ERRORS },
    }),
    async (c) =>
      (await deleteAsset(uc)(c.var.userId, c.req.valid('param').id)).match(
        () => c.body(null, 204),
        (e) => fail(c, e),
      ),
  );

  r.openapi(
    createRoute({
      method: 'get',
      path: '/assets/{assetId}/valuations',
      security: [{ bearer: [] }],
      request: { params: AssetIdParamSchema },
      responses: { 200: json(z.array(ValuationDtoSchema), 'Newest first'), ...ERRORS },
    }),
    async (c) =>
      (await listValuations(vc)(c.var.userId, c.req.valid('param').assetId)).match(
        (dtos) => c.json(dtos, 200),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'post',
      path: '/assets/{assetId}/valuations',
      security: [{ bearer: [] }],
      request: { params: AssetIdParamSchema, body: body(ValuationInputSchema) },
      responses: { 201: json(ValuationDtoSchema, 'Recorded'), ...ERRORS },
    }),
    async (c) =>
      (
        await addValuation(vc)(c.var.userId, c.req.valid('param').assetId, c.req.valid('json'))
      ).match(
        (dto) => c.json(dto, 201),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'patch',
      path: '/valuations/{id}',
      security: [{ bearer: [] }],
      request: { params: IdParamSchema, body: body(UpdateValuationInputSchema) },
      responses: { 200: json(ValuationDtoSchema, 'Updated'), ...ERRORS },
    }),
    async (c) =>
      (await updateValuation(vc)(c.var.userId, c.req.valid('param').id, c.req.valid('json'))).match(
        (dto) => c.json(dto, 200),
        (e) => fail(c, e),
      ),
  );
  r.openapi(
    createRoute({
      method: 'delete',
      path: '/valuations/{id}',
      security: [{ bearer: [] }],
      request: { params: IdParamSchema },
      responses: { 204: { description: 'Deleted' }, ...ERRORS },
    }),
    async (c) =>
      (await deleteValuation(vc)(c.var.userId, c.req.valid('param').id)).match(
        () => c.body(null, 204),
        (e) => fail(c, e),
      ),
  );
  return r;
}
