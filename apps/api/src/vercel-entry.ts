import { handle } from 'hono/vercel';
import { createApp } from './app.js';
import { depsFromEnv } from './bootstrap.js';
import { loadEnv } from './shared/env.js';

const app = createApp(depsFromEnv(loadEnv()));

export default handle(app);
