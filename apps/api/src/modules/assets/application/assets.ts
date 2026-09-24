import { err, ok, type Result } from 'neverthrow';
import { UnknownCurrencyError, type CurrencyLookup } from '@magermoney/domain';
import type { AssetDto, AssetInput, UpdateAssetInput } from '@magermoney/contracts';
import type { Repos } from '../../../app.js';
import { NotFoundError } from '../../../shared/errors/http.js';
import type { AssetPatch, NewAsset } from './asset-repository.js';
import { toAssetDto } from './dto.js';

export interface AssetDeps {
  repos: Pick<Repos, 'assets' | 'valuations'>;
  registry: CurrencyLookup;
}
export type AssetFailure = NotFoundError | UnknownCurrencyError;

/** Archived assets are part of the list: the client decides what it shows. */
export const listAssets =
  (deps: AssetDeps) =>
  async (userId: string): Promise<AssetDto[]> =>
    (await deps.repos.assets.list(userId)).map(toAssetDto);

export const createAsset =
  (deps: AssetDeps) =>
  async (userId: string, input: AssetInput): Promise<Result<AssetDto, AssetFailure>> => {
    if (!deps.registry.has(input.currency)) return err(new UnknownCurrencyError(input.currency));
    const data: NewAsset = {
      name: input.name.trim(),
      icon: input.icon ?? null,
      color: input.color ?? null,
      currency: input.currency,
      countsInTotal: input.countsInTotal,
      acquiredOn: input.acquiredOn ?? null,
      purchasePrice: input.purchasePrice ?? null,
    };
    return ok(toAssetDto(await deps.repos.assets.insert(userId, data)));
  };

export const updateAsset =
  (deps: AssetDeps) =>
  async (
    userId: string,
    id: string,
    input: UpdateAssetInput,
  ): Promise<Result<AssetDto, AssetFailure>> => {
    const current = await deps.repos.assets.findById(userId, id);
    if (!current) return err(new NotFoundError('asset'));
    if (input.currency !== undefined && !deps.registry.has(input.currency))
      return err(new UnknownCurrencyError(input.currency));
    const patch: AssetPatch = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.icon !== undefined) patch.icon = input.icon;
    if (input.color !== undefined) patch.color = input.color;
    if (input.currency !== undefined) patch.currency = input.currency;
    if (input.countsInTotal !== undefined) patch.countsInTotal = input.countsInTotal;
    if (input.acquiredOn !== undefined) patch.acquiredOn = input.acquiredOn;
    if (input.purchasePrice !== undefined) patch.purchasePrice = input.purchasePrice;
    if (input.archivedAt !== undefined) patch.archivedAt = input.archivedAt;
    const row = await deps.repos.assets.update(userId, id, patch);
    return row ? ok(toAssetDto(row)) : err(new NotFoundError('asset'));
  };

/** A valuation outside its asset means nothing, so deleting the asset takes them. */
export const deleteAsset =
  (deps: AssetDeps) =>
  async (userId: string, id: string): Promise<Result<void, NotFoundError>> =>
    (await deps.repos.assets.delete(userId, id)) ? ok(undefined) : err(new NotFoundError('asset'));
