import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { MemoryRateRepository } from '../src/modules/rates/infrastructure/memory-rate-repository.js';
import { testDeps } from './helpers/deps.js';
import { authed, OTHER, SECRET, UID } from './helpers/http.js';

describe('DELETE /rates/manual', () => {
  it("removes only the caller's override", async () => {
    const rates = new MemoryRateRepository([
      {
        base: 'RUB',
        quote: 'USD',
        value: '0.01',
        date: '2026-01-01',
        source: 'manual',
        userId: UID,
      },
      { base: 'RUB', quote: 'USD', value: '0.02', date: '2026-01-01', source: 'api', userId: null },
    ]);
    const app = createApp(testDeps({ rates, jwtSecret: SECRET }));
    expect(
      (await authed(app, 'DELETE', '/rates/manual?base=RUB&date=2026-01-01', undefined, OTHER))
        .status,
    ).toBe(404);
    expect((await authed(app, 'DELETE', '/rates/manual?base=RUB&date=2026-01-01')).status).toBe(
      204,
    );
    expect(rates.rows).toHaveLength(1);
    expect(rates.rows[0]?.source).toBe('api');
  });
});
