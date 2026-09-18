import { describe, expect, it, vi } from 'vitest';
import { expensesApi } from '../src/modules/expenses/infrastructure/expenses-api.js';

const dto = {
  id: '11111111-1111-4111-8111-111111111111',
  categoryId: '22222222-2222-4222-8222-222222222222',
  name: 'Rent',
  amount: '1400',
  currency: 'EUR',
  period: 'monthly',
  billingDay: 5,
  billingMonth: null,
  isEssential: true,
  activeFrom: '2026-01-01',
  activeTo: null,
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('expensesApi', () => {
  it('lists expenses and categories through the contract', async () => {
    const fetch = vi.fn(async (path: string) =>
      path === '/expenses'
        ? json([dto])
        : json([{ id: dto.categoryId, name: 'Housing', icon: null, sortOrder: 0 }]),
    );
    const api = expensesApi({ fetch });
    expect((await api.list())[0]?.name).toBe('Rent');
    expect((await api.categories())[0]?.name).toBe('Housing');
  });

  it('posts a new expense with a category name', async () => {
    const fetch = vi.fn(async () => json(dto, 201));
    await expensesApi({ fetch }).create({
      categoryName: 'Housing',
      name: 'Rent',
      amount: '1400',
      currency: 'EUR',
      period: 'monthly',
      isEssential: true,
      activeFrom: '2026-01-01',
    });
    const [path, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe('/expenses');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body)).categoryName).toBe('Housing');
  });

  it('rejects a malformed body', async () => {
    const fetch = vi.fn(async () => json([{ id: 'nope' }]));
    await expect(expensesApi({ fetch }).list()).rejects.toThrow();
  });
});
