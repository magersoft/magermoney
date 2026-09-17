import { describe, expect, it } from 'vitest';
import { ratesApi } from '../src/modules/rates/infrastructure/rates-api.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('ratesApi manual overrides', () => {
  it('PUTs a manual rate and DELETEs by query', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const api = ratesApi({
      fetch: async (p, i) => {
        calls.push([p, i]);
        return i?.method === 'DELETE'
          ? new Response(null, { status: 204 })
          : json({
              base: 'RUB',
              quote: 'USD',
              value: '0.012',
              date: '2026-01-01',
              source: 'manual',
            });
      },
    });
    await api.setManual({ base: 'RUB', date: '2026-01-01', value: '0.012' });
    await api.removeManual('RUB', '2026-01-01');
    expect(calls[0]).toMatchObject(['/rates/manual', { method: 'PUT' }]);
    expect(calls[1]?.[0]).toBe('/rates/manual?base=RUB&date=2026-01-01');
  });
});
