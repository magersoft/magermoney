/**
 * Produces a Vercel Build Output API (v3) tree for the API.
 *
 * Zero-config `api/*` functions are discovered before the build command runs,
 * so a bundle written by the build command was never picked up. Writing the
 * output tree directly makes the deployment deterministic: one Node function
 * (the esbuild bundle of `src/vercel-entry.ts`), one rewrite, two crons.
 */
import { build } from 'esbuild';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '../vercel.js';

const out = join(process.cwd(), '.vercel', 'output');
const fn = join(out, 'functions', 'api.func');

await rm(out, { recursive: true, force: true });
await mkdir(fn, { recursive: true });

await build({
  entryPoints: ['src/vercel-entry.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  outfile: join(fn, 'index.mjs'),
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: 'info',
});

await writeFile(
  join(fn, '.vc-config.json'),
  JSON.stringify(
    {
      runtime: 'nodejs24.x',
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      supportsResponseStreaming: true,
    },
    null,
    2,
  ),
);

await writeFile(
  join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [{ src: '/(.*)', dest: '/api' }],
      crons: config.crons ?? [],
    },
    null,
    2,
  ),
);

console.log(`Build Output API tree written to ${out}`);
