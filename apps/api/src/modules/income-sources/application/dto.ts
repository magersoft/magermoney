import { Decimal, Money, netMonthly, type CurrencyLookup } from '@magermoney/domain';
import type { IncomeSourceDto } from '@magermoney/contracts';
import type { IncomeSourceRow } from './income-source-repository.js';

/** Net is derived on the way out and never stored. */
export function toIncomeSourceDto(row: IncomeSourceRow, registry: CurrencyLookup): IncomeSourceDto {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { userId: _u, ...rest } = row;
  const currency = registry
    .get(row.currency)
    .unwrapOr({ code: row.currency, kind: 'fiat' as const, scale: 2 });
  const net = netMonthly({
    grossAmount: Money.of(row.grossAmount, currency),
    taxRate: new Decimal(row.taxRate),
    commissionRate: new Decimal(row.commissionRate),
  });
  return { ...rest, netMonthly: net.toString() };
}
