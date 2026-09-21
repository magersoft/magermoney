import type { AssetDto, ValuationDto } from '@magermoney/contracts';
import type { AssetRow } from './asset-repository.js';
import type { ValuationRow } from './valuation-repository.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const toAssetDto = ({ userId: _u, ...row }: AssetRow): AssetDto => row;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const toValuationDto = ({ userId: _u, ...row }: ValuationRow): ValuationDto => row;
