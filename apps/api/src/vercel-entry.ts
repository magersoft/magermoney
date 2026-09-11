import { getRequestListener } from '@hono/node-server';
import { createApp } from './app.js';
import { depsFromEnv } from './bootstrap.js';
import { loadEnv } from './shared/env.js';

const app = createApp(depsFromEnv(loadEnv()));

// The Build Output API Node launcher calls a classic (req, res) listener;
// getRequestListener adapts Hono's fetch handler to it.
export default getRequestListener(app.fetch);
