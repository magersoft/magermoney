/**
 * Imports the owner's spreadsheet from CSV files that never enter the
 * repository: the "Счета" sheet and the yearly rates block (phase 2), the
 * income sources, "Поступления" and expenses sheets (phase 3). Reads
 * DATABASE_URL from the environment; point it at local Supabase or, with
 * `.env.prod.local`, at production.
 *
 *   bun run import -- --user me@example.com --income-sources imports/income-sources.csv \
 *     --inflows imports/inflows.csv --expenses imports/expenses.csv --as-budget "Groceries" --dry-run
 */
import { createDb } from '../src/shared/db/client.js';
import { parseArgs, runImport } from './import/run.js';

let sql: ReturnType<typeof createDb> | undefined;
try {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (run `vercel env pull` or export it)');
  sql = createDb(url);
  await runImport(parseArgs(process.argv.slice(2)), sql);
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
} finally {
  await sql?.end();
}
