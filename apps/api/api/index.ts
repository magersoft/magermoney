import { handle } from 'hono/vercel';
import { createApp } from '../src/app.js';
import { depsFromEnv } from '../src/bootstrap.js';
import { loadEnv } from '../src/shared/env.js';

const app = createApp(depsFromEnv(loadEnv()));

export default handle(app);
