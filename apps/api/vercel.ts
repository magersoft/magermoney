import { routes, type VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  framework: null,
  rewrites: [routes.rewrite('/(.*)', '/api')],
  crons: [
    { path: '/jobs/rates?kind=fiat', schedule: '15 6 * * *' },
    { path: '/jobs/rates?kind=crypto', schedule: '5 * * * *' },
  ],
};
