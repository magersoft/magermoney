import { routes, type VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  framework: null,
  // Functions-only project: Vercel still wants a static output directory.
  outputDirectory: 'public',
  // Bundle the function with esbuild: workspace packages ship TypeScript sources,
  // which Vercel's tracer does not compile.
  buildCommand: 'bun run build:vercel',
  rewrites: [routes.rewrite('/(.*)', '/api')],
  // Vercel Hobby allows at most two cron jobs, each at most once a day, and
  // invokes them with GET + `Authorization: Bearer $CRON_SECRET`.
  // Phase 2, on Pro: move crypto back to hourly (`5 * * * *`).
  crons: [
    { path: '/jobs/rates?kind=fiat', schedule: '15 6 * * *' },
    { path: '/jobs/rates?kind=crypto', schedule: '45 6 * * *' },
  ],
};
