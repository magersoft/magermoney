import type { InflowDto } from '@magermoney/contracts';
import type { InflowRow } from './inflow-repository.js';

/** `realisedRate` (credited / amount) exists only for a cross-currency credit; the caller derives it. */
export function toInflowDto(row: InflowRow, realisedRate: string | null = null): InflowDto {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { userId: _u, ...rest } = row;
  return { ...rest, realisedRate };
}
