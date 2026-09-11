import { describe, expect, it } from 'vitest';
import { FixedClock } from '@magermoney/domain';
import { createApp, originAllowList } from '../src/app.js';
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

  it('hides the OpenAPI document when docs are not exposed', async () => {
    const closed = createApp(testDeps({ exposeDocs: false }));
    expect((await closed.request('/openapi.json')).status).toBe(404);
    expect((await closed.request('/docs')).status).toBe(404);
  });

  it('returns a JSON error body for unknown routes', async () => {
    const res = await app.request('/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ code: 'NOT_FOUND', message: 'Route not found' });
  });
});

describe('cors allow list', () => {
  it('echoes an allowed origin and refuses anything else', async () => {
    const allow = originAllowList(testDeps({ corsOrigins: ['https://app.magermoney.dev'] }));
    expect(allow('https://app.magermoney.dev')).toBe('https://app.magermoney.dev');
    expect(allow('https://evil.example')).toBeNull();
    expect(allow('https://magermoney-abc123.vercel.app')).toBeNull();
  });

  it('allows vercel previews only when enabled', async () => {
    const allow = originAllowList(testDeps({ allowVercelPreviews: true }));
    expect(allow('https://magermoney-abc123.vercel.app')).toBe(
      'https://magermoney-abc123.vercel.app',
    );
    expect(allow('http://localhost:5173')).toBe('http://localhost:5173');
    expect(allow('https://evil.example')).toBeNull();
  });

  it('does not reflect a foreign origin over the wire', async () => {
    const app = createApp(testDeps({ corsOrigins: ['http://localhost:5173'] }));
    const res = await app.request('/health', { headers: { origin: 'https://evil.example' } });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    const okRes = await app.request('/health', { headers: { origin: 'http://localhost:5173' } });
    expect(okRes.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });
});
