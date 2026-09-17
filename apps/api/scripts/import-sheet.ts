/**
 * Imports the owner's "Счета" sheet (and the yearly rates block) from CSV files
 * that never enter the repository. Reads DATABASE_URL from the environment;
 * point it at local Supabase or, with `.env.prod.local`, at production.
 *
 *   bun run import -- --user me@example.com --accounts imports/accounts.csv --rates imports/rates.csv --dry-run
 */
import { createDb } from '../src/shared/db/client.js';
import { parseArgs, runImport } from './import/run.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set (run `vercel env pull` or export it)');
const sql = createDb(url);
try {
  await runImport(parseArgs(process.argv.slice(2)), sql);
} finally {
  await sql.end();
}
