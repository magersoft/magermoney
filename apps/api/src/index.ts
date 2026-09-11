import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { depsFromEnv } from './bootstrap.js';
import { loadEnv } from './shared/env.js';

const app = createApp(depsFromEnv(loadEnv()));

serve({ fetch: app.fetch, port: 3000 }, (i) => console.log(`api on http://localhost:${i.port}`));
