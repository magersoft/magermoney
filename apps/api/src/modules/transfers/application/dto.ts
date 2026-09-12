import { deriveTransfer, Money, type Currency } from '@magermoney/domain';
import type { TransferDto } from '@magermoney/contracts';
import type { TransferRow } from './transfer-repository.js';

export function toTransferDto(row: TransferRow, from: Currency, to: Currency): TransferDto {
  const derived = deriveTransfer({
    amountSent: Money.of(row.amountSent, from),
    amountReceived: Money.of(row.amountReceived, to),
  }).unwrapOr({ realisedRate: null, fee: null });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { userId: _u, ...rest } = row;
  return {
    ...rest,
    realisedRate: derived.realisedRate?.toFixed() ?? null,
    fee: derived.fee?.toString() ?? null,
  };
}
