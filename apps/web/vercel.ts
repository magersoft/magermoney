import { routes, type VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  framework: 'vite',
  // Every path is the SPA shell; the router resolves it in the browser.
  rewrites: [routes.rewrite('/(.*)', '/index.html')],
  headers: [
    // The shell updates through the service worker, so the worker itself must
    // never be served from cache.
    { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
  ],
};
