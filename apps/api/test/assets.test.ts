import { describe, expect, it } from 'vitest';
import { FixedClock } from '@magermoney/domain';
import { createApp } from '../src/app.js';
import { testDeps } from './helpers/deps.js';
import { authed, OTHER, SECRET } from './helpers/http.js';

const NOW = new Date('2026-09-21T12:00:00.000Z');
const TODAY = '2026-09-21';
const mk = () => createApp(testDeps({ jwtSecret: SECRET, clock: new FixedClock(NOW) }));
const bmw = { name: 'BMW 530e', currency: 'EUR', countsInTotal: true };

const newAsset = async (app: ReturnType<typeof mk>) =>
  (await authed(app, 'POST', '/assets', bmw)).json();

describe('assets', () => {
  it('starts with no value and takes the latest valuation afterwards', async () => {
    const app = mk();
    const asset = await newAsset(app);
    expect(asset).toMatchObject({ value: null, valuedOn: null, countsInTotal: true });

    await authed(app, 'POST', `/assets/${asset.id}/valuations`, {
      value: '28000',
      valuedOn: '2026-01-01',
    });
    await authed(app, 'POST', `/assets/${asset.id}/valuations`, {
      value: '30000',
      valuedOn: '2026-09-01',
    });

    const [listed] = await (await authed(app, 'GET', '/assets')).json();
    expect(listed).toMatchObject({ value: '30000', valuedOn: '2026-09-01' });
  });

  it('serves the journal newest first', async () => {
    const app = mk();
    const asset = await newAsset(app);
    await authed(app, 'POST', `/assets/${asset.id}/valuations`, {
      value: '28000',
      valuedOn: '2026-01-01',
    });
    await authed(app, 'POST', `/assets/${asset.id}/valuations`, {
      value: '30000',
      valuedOn: '2026-09-01',
    });

    const journal = await (await authed(app, 'GET', `/assets/${asset.id}/valuations`)).json();
    expect(journal.map((v: { valuedOn: string }) => v.valuedOn)).toEqual([
      '2026-09-01',
      '2026-01-01',
    ]);
  });

  it('refuses a second valuation on a date the asset already has', async () => {
    const app = mk();
    const asset = await newAsset(app);
    await authed(app, 'POST', `/assets/${asset.id}/valuations`, {
      value: '28000',
      valuedOn: '2026-01-01',
    });

    const res = await authed(app, 'POST', `/assets/${asset.id}/valuations`, {
      value: '29000',
      valuedOn: '2026-01-01',
    });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('valuation_exists');
  });

  it('refuses a valuation that is not positive', async () => {
    const app = mk();
    const asset = await newAsset(app);
    expect(
      (await authed(app, 'POST', `/assets/${asset.id}/valuations`, { value: '0' })).status,
    ).toBe(400);
  });

  it('dates a valuation today when none is given', async () => {
    const app = mk();
    const asset = await newAsset(app);
    const v = await (
      await authed(app, 'POST', `/assets/${asset.id}/valuations`, { value: '30000' })
    ).json();
    expect(v.valuedOn).toBe(TODAY);
  });

  it('takes the valuations with the asset', async () => {
    const app = mk();
    const asset = await newAsset(app);
    await authed(app, 'POST', `/assets/${asset.id}/valuations`, { value: '30000' });

    expect((await authed(app, 'DELETE', `/assets/${asset.id}`)).status).toBe(204);
    expect((await authed(app, 'GET', `/assets/${asset.id}/valuations`)).status).toBe(404);
  });

  it('does not serve another user their neighbour assets', async () => {
    const app = mk();
    await newAsset(app);
    expect(await (await authed(app, 'GET', '/assets', undefined, OTHER)).json()).toEqual([]);
  });
});
