export const SOURCE_ID = '11111111-1111-4111-8111-111111111111';
export const INFLOW_ID = '22222222-2222-4222-8222-222222222222';
export const sourceDto = {
  id: SOURCE_ID,
  name: 'Salary',
  grossAmount: '1000',
  currency: 'USD',
  taxRate: '0.15',
  commissionRate: '0.1',
  payDays: [10, 25],
  isPrimary: true,
  activeFrom: '2026-01-01',
  activeTo: null,
  defaultAccountId: null,
  netMonthly: '765.00',
};
export const inflowDto = {
  id: INFLOW_ID,
  incomeSourceId: SOURCE_ID,
  amount: '500',
  currency: 'USD',
  receivedOn: '2026-09-10',
  realisedRateToUsd: null,
  accountId: null,
  creditedAmount: null,
  realisedRate: null,
  note: null,
};
