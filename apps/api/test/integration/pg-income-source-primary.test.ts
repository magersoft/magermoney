import { describe, expect, it } from 'vitest';
import { createIncomeSource } from '../../src/modules/income-sources/application/create-income-source.js';
import { updateIncomeSource } from '../../src/modules/income-sources/application/update-income-source.js';
import { deps, newUser, salary, sql } from './helpers.js';

const primaries = async (uid: string) =>
  (
    await sql<{ id: string }[]>`
      select id from income_sources where user_id = ${uid} and is_primary order by id`
  ).map((r) => r.id);

describe('the primary income source', () => {
  it('moves from one source to another', async () => {
    const uid = await newUser('prim');
    const a = (
      await createIncomeSource(deps)(uid, { ...salary, name: 'A', isPrimary: true })
    )._unsafeUnwrap();
    const b = (
      await createIncomeSource(deps)(uid, { ...salary, name: 'B', isPrimary: true })
    )._unsafeUnwrap();
    expect(await primaries(uid)).toEqual([b.id]);
    expect((await updateIncomeSource(deps)(uid, a.id, { isPrimary: true })).isOk()).toBe(true);
    expect(await primaries(uid)).toEqual([a.id]);
  });

  it('stays single when two sources claim it at the same moment', async () => {
    const uid = await newUser('prim');
    const a = (await createIncomeSource(deps)(uid, { ...salary, name: 'A' }))._unsafeUnwrap();
    const b = (await createIncomeSource(deps)(uid, { ...salary, name: 'B' }))._unsafeUnwrap();
    // Task 8 queues the claimants on `incomeSources.lockAll` (a transaction-scoped advisory lock),
    // so neither trips the unique index: both succeed, one after the other, and the last one holds the flag.
    const results = await Promise.all([
      updateIncomeSource(deps)(uid, a.id, { isPrimary: true }),
      updateIncomeSource(deps)(uid, b.id, { isPrimary: true }),
    ]);
    expect(results.every((r) => r.isOk())).toBe(true);
    const now = await primaries(uid);
    expect(now).toHaveLength(1);
    expect([a.id, b.id]).toContain(now[0]);
  });

  it('survives a promotion racing a rename of the source that is currently primary', async () => {
    const uid = await newUser('prim');
    const a = (
      await createIncomeSource(deps)(uid, { ...salary, name: 'A', isPrimary: true })
    )._unsafeUnwrap();
    const b = (await createIncomeSource(deps)(uid, { ...salary, name: 'B' }))._unsafeUnwrap();
    // The rename says nothing about `isPrimary` and still writes back what it read.
    // Without the unconditional lock it reads A as primary while B is being promoted,
    // and re-asserting that flag trips `income_sources_one_primary_idx`.
    const results = await Promise.all([
      updateIncomeSource(deps)(uid, b.id, { isPrimary: true }),
      updateIncomeSource(deps)(uid, a.id, { name: 'A renamed' }),
    ]);
    expect(results.every((r) => r.isOk())).toBe(true);
    expect(await primaries(uid)).toHaveLength(1);
  });

  it('stays single when two new sources are created as primary at the same moment, the user having none', async () => {
    const uid = await newUser('prim');
    // No rows to lock yet: this is why the lock is advisory and not `for update`.
    const results = await Promise.all([
      createIncomeSource(deps)(uid, { ...salary, name: 'A', isPrimary: true }),
      createIncomeSource(deps)(uid, { ...salary, name: 'B', isPrimary: true }),
    ]);
    expect(results.every((r) => r.isOk())).toBe(true);
    expect(await primaries(uid)).toHaveLength(1);
  });

  it('is scoped to the user: one primary each', async () => {
    const u1 = await newUser('prim');
    const u2 = await newUser('prim');
    const s1 = (await createIncomeSource(deps)(u1, { ...salary, isPrimary: true }))._unsafeUnwrap();
    const s2 = (await createIncomeSource(deps)(u2, { ...salary, isPrimary: true }))._unsafeUnwrap();
    expect(await primaries(u1)).toEqual([s1.id]);
    expect(await primaries(u2)).toEqual([s2.id]);
  });

  it('the partial unique index is the last line of defence', async () => {
    const uid = await newUser('prim');
    await createIncomeSource(deps)(uid, { ...salary, name: 'A', isPrimary: true });
    await expect(
      sql`insert into income_sources (user_id, name, gross_amount, currency, is_primary, active_from)
          values (${uid}, 'forced', 1, 'USD', true, '2026-01-01')`,
    ).rejects.toThrow();
  });
});
