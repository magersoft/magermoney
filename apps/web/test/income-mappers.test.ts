import { describe, expect, it } from 'vitest';
import { CurrencyRegistry } from '@magermoney/domain';
import { toIncomeSource, toInflow } from '../src/modules/income/domain/mappers.js';
import { inflowDto, sourceDto } from './fixtures/income.js';

const registry = new CurrencyRegistry([
  { code: 'USD', kind: 'fiat', scale: 2 },
  { code: 'EUR', kind: 'fiat', scale: 2 },
]);

describe('toIncomeSource', () => {
  it('turns strings into Money and Decimal once, at the boundary', () => {
    const s = toIncomeSource(sourceDto, registry);
    expect(s.grossAmount.toString()).toBe('1000');
    expect(s.grossAmount.currency.code).toBe('USD');
    expect(s.taxRate.toFixed()).toBe('0.15');
    expect(s.commissionRate.toFixed()).toBe('0.1');
    expect(s.payDays).toEqual([10, 25]);
    expect(s.activeTo).toBeNull();
  });
  it('still renders a source whose currency the registry does not know', () => {
    const s = toIncomeSource({ ...sourceDto, currency: 'XXX' }, registry);
    expect(s.grossAmount.currency).toEqual({ code: 'XXX', kind: 'fiat', scale: 2 });
  });
});

describe('toInflow', () => {
  it('maps an uncredited inflow', () => {
    const i = toInflow(inflowDto, registry);
    expect(i.amount.toString()).toBe('500');
    expect(i.creditedAmount).toBeNull();
    expect(i.realisedRateToUsd).toBeNull();
  });
  it('puts the credited amount in the account currency the caller names', () => {
    const dto = {
      ...inflowDto,
      accountId: '33333333-3333-4333-8333-333333333333',
      creditedAmount: '430',
      realisedRateToUsd: '1',
    };
    expect(toInflow(dto, registry, 'EUR').creditedAmount?.currency.code).toBe('EUR');
    expect(toInflow(dto, registry).creditedAmount).toBeNull();
    expect(toInflow(dto, registry).realisedRateToUsd?.toFixed()).toBe('1');
  });
});
