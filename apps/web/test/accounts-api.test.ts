import { describe, expect, it } from 'vitest';
import { accountsApi } from '../src/modules/accounts/infrastructure/accounts-api.js';

const dto = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Alfa',
  bank: 'Alfa',
  country: 'RU',
  currency: 'RUB',
  kind: 'bank_account',
  cardType: null,
  isSpending: true,
  cardLast4: null,
  cardNetwork: null,
  cardTier: null,
  cardExpires: null,
  note: null,
  sortOrder: 0,
  archivedAt: null,
  balance: '10',
  balanceRecordedAt: '2026-09-11T00:00:00.000Z',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('accountsApi', () => {
  it('lists, records a balance, and encodes the cursor', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const api = accountsApi({
      fetch: async (path, init) => {
        calls.push([path, init]);
        return path.includes('/balances') ? json([]) : json([dto]);
      },
    });
    expect(await api.list()).toEqual([dto]);
    await api.balances(dto.id, `2026-09-11T00:00:00.000Z|${dto.id}`);
    expect(calls[1]?.[0]).toBe(
      `/accounts/${dto.id}/balances?limit=200&before=2026-09-11T00%3A00%3A00.000Z%7C${dto.id}`,
    );
    await api.recordBalance(dto.id, { amount: '12' }).catch(() => undefined);
    expect(calls[2]?.[1]?.method).toBe('POST');
    expect(calls[2]?.[1]?.body).toBe(JSON.stringify({ amount: '12' }));
  });
  it('throws a typed error on a 409', async () => {
    const api = accountsApi({
      fetch: async () => json({ code: 'entry_not_latest', message: 'no' }, 409),
    });
    await expect(api.editBalance('x', { amount: '1' })).rejects.toMatchObject({
      status: 409,
      code: 'entry_not_latest',
    });
  });
});
