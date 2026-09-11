import { describe, expect, it } from 'vitest';
import { createDb } from '../../src/shared/db/client.js';
import { PgRateRepository } from '../../src/modules/rates/infrastructure/pg-rate-repository.js';

describe('PgRateRepository', () => {
  const sql = createDb(process.env.DATABASE_URL!);
  const repo = new PgRateRepository(sql);
  const anyUuid = '00000000-0000-0000-0000-000000000000';

  it('upserts api rows and returns the newest on or before a date', async () => {
    await repo.upsertMany([
      { base: 'EUR', value: '1.10', date: '2026-09-09', source: 'api', userId: null },
      { base: 'EUR', value: '1.16', date: '2026-09-10', source: 'api', userId: null },
    ]);
    const rows = await repo.latestOnOrBefore('2026-09-10', anyUuid);
    const eur = rows.filter((r) => r.base === 'EUR').sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    expect(eur).toMatchObject({ value: '1.16', date: '2026-09-10' });
  });

  it('updates the value on conflict instead of duplicating', async () => {
    await repo.upsertMany([{ base: 'EUR', value: '1.20', date: '2026-09-10', source: 'api', userId: null }]);
    const rows = await repo.latestOnOrBefore('2026-09-10', anyUuid);
    const eurRows = rows.filter((r) => r.base === 'EUR' && r.date === '2026-09-10' && r.source === 'api');
    expect(eurRows).toHaveLength(1);
    expect(eurRows[0]?.value).toBe('1.20');
  });
});
