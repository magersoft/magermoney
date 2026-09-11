import { describe, expect, it } from 'vitest';
import { FixedClock } from '@magermoney/domain';
import { createApp } from '../src/app.js';
import { testDeps } from './helpers/deps.js';

describe('app', () => {
  const app = createApp(testDeps({ clock: new FixedClock(new Date('2026-09-11T10:00:00Z')) }));

  it('answers health with the clock date', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, date: '2026-09-11' });
  });

  it('serves the OpenAPI document', async () => {
    const res = await app.request('/openapi.json');
    expect(res.status).toBe(200);
    expect((await res.json()).info.title).toBe('Magermoney API');
  });

  it('returns a JSON error body for unknown routes', async () => {
    const res = await app.request('/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ code: 'NOT_FOUND', message: 'Route not found' });
  });
});
