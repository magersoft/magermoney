import { describe, expect, it } from 'vitest';
import { incomeSourcesApi } from '../src/modules/income/infrastructure/income-sources-api.js';
import { inflowsApi } from '../src/modules/income/infrastructure/inflows-api.js';
import { INFLOW_ID, SOURCE_ID, inflowDto, sourceDto } from './fixtures/income.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('incomeSourcesApi', () => {
  it('lists, creates, updates and deletes through the documented routes', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const api = incomeSourcesApi({
      fetch: async (path, init) => {
        calls.push([path, init]);
        if (init?.method === 'DELETE') return new Response(null, { status: 204 });
        return init?.method === 'GET' ? json([sourceDto]) : json(sourceDto);
      },
    });
    expect(await api.list()).toEqual([sourceDto]);
    await api.create({
      name: 'Salary',
      grossAmount: '1000',
      currency: 'USD',
      taxRate: '0.15',
      commissionRate: '0.1',
      payDays: [10, 25],
      isPrimary: true,
      activeFrom: '2026-01-01',
    });
    await api.update(SOURCE_ID, { activeTo: '2026-12-31' });
    await api.remove(SOURCE_ID);
    expect(calls.map(([p, i]) => `${i?.method} ${p}`)).toEqual([
      'GET /income-sources',
      'POST /income-sources',
      `PATCH /income-sources/${SOURCE_ID}`,
      `DELETE /income-sources/${SOURCE_ID}`,
    ]);
    expect(JSON.parse(calls[2]?.[1]?.body as string)).toEqual({ activeTo: '2026-12-31' });
  });
  it('refuses a body that is not the contract', async () => {
    const api = incomeSourcesApi({ fetch: async () => json([{ id: 'nope' }]) });
    await expect(api.list()).rejects.toMatchObject({ code: 'MALFORMED_RESPONSE' });
  });
});

describe('inflowsApi', () => {
  it('sends only the filters that were given, and asks for the biggest page', async () => {
    const paths: string[] = [];
    const api = inflowsApi({
      fetch: async (path) => {
        paths.push(path);
        return json([inflowDto]);
      },
    });
    expect(await api.list({})).toEqual([inflowDto]);
    await api.list({ from: '2026-09-01', to: '2026-09-30', sourceId: SOURCE_ID });
    expect(paths).toEqual([
      '/inflows?limit=200',
      `/inflows?limit=200&from=2026-09-01&to=2026-09-30&sourceId=${SOURCE_ID}`,
    ]);
  });
  it('creates, updates and deletes', async () => {
    const calls: string[] = [];
    const api = inflowsApi({
      fetch: async (path, init) => {
        calls.push(`${init?.method} ${path}`);
        return init?.method === 'DELETE'
          ? new Response(null, { status: 204 })
          : json(inflowDto, 201);
      },
    });
    await api.create({ incomeSourceId: SOURCE_ID, amount: '500' });
    await api.update(INFLOW_ID, { accountId: null });
    await api.remove(INFLOW_ID);
    expect(calls).toEqual([
      'POST /inflows',
      `PATCH /inflows/${INFLOW_ID}`,
      `DELETE /inflows/${INFLOW_ID}`,
    ]);
  });
});
