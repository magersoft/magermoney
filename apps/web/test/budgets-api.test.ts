import { describe, expect, it, vi } from 'vitest';
import { budgetsApi } from '../src/modules/budgets/infrastructure/budgets-api.js';

const dto = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Groceries',
  icon: null,
  monthlyLimit: '1000',
  currency: 'EUR',
  activeFrom: '2026-01-01',
  activeTo: null,
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('budgetsApi', () => {
  it('lists, creates, patches and deletes through the contract', async () => {
    const fetch = vi.fn(async (_p: string, init?: RequestInit) =>
      init?.method === 'DELETE'
        ? new Response(null, { status: 204 })
        : json(init?.method === 'GET' ? [dto] : dto),
    );
    const api = budgetsApi({ fetch });
    expect((await api.list())[0]?.name).toBe('Groceries');
    await api.create({
      name: 'Groceries',
      monthlyLimit: '1000',
      currency: 'EUR',
      activeFrom: '2026-01-01',
    });
    await api.update(dto.id, { monthlyLimit: '900' });
    await api.remove(dto.id);
    expect(fetch.mock.calls.map(([p, i]) => `${(i as RequestInit).method} ${p}`)).toEqual([
      'GET /budgets',
      'POST /budgets',
      `PATCH /budgets/${dto.id}`,
      `DELETE /budgets/${dto.id}`,
    ]);
  });
});
