import { describe, expect, it } from 'vitest';
import { deps, newUser, sql } from './helpers.js';

const { repos } = deps;

const goal = {
  name: 'Car',
  icon: null,
  color: null,
  targetAmount: '10000',
  currency: 'USD',
  targetDate: null,
  achievedAt: null,
  archivedAt: null,
  sortOrder: 0,
};
const asset = {
  name: 'Watch',
  icon: null,
  color: null,
  currency: 'USD',
  countsInTotal: false,
  acquiredOn: null,
  purchasePrice: null,
};

describe('the mark of a goal and an asset, in postgres', () => {
  it('stores, changes and clears an emoji and a colour on both', async () => {
    const uid = await newUser('marks');
    const g = await repos.goals.insert(uid, { ...goal, icon: '🏖️', color: 'teal' });
    expect(g).toMatchObject({ icon: '🏖️', color: 'teal' });
    expect(await repos.goals.update(uid, g.id, { color: null })).toMatchObject({
      icon: '🏖️',
      color: null,
    });

    const a = await repos.assets.insert(uid, { ...asset, icon: '⌚', color: 'amber' });
    expect(a).toMatchObject({ icon: '⌚', color: 'amber' });
    expect(await repos.assets.update(uid, a.id, { icon: null })).toMatchObject({
      icon: null,
      color: 'amber',
    });
  });

  it('reads a row with neither as unmarked', async () => {
    const uid = await newUser('marks');
    const g = await repos.goals.insert(uid, goal);
    const a = await repos.assets.insert(uid, asset);
    expect(g).toMatchObject({ icon: null, color: null });
    expect(a).toMatchObject({ icon: null, color: null });
  });

  it('refuses a colour outside the palette and an icon longer than an emoji can be', async () => {
    const uid = await newUser('marks');
    await expect(repos.goals.insert(uid, { ...goal, color: 'magenta' as never })).rejects.toThrow();
    await expect(repos.assets.insert(uid, { ...asset, icon: 'x'.repeat(17) })).rejects.toThrow();
    await expect(repos.goals.insert(uid, { ...goal, icon: 'x'.repeat(17) })).rejects.toThrow();
  });

  it('keeps the colour list in step with the domain palette', async () => {
    const rows = await sql<{ def: string }[]>`
      select pg_get_constraintdef(oid) as def from pg_constraint
      where conname in ('goals_color_check', 'assets_color_check')`;
    expect(rows).toHaveLength(2);
    for (const { def } of rows)
      for (const c of ['red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink'])
        expect(def).toContain(`'${c}'`);
  });
});
