import { readFile } from 'node:fs/promises';
import type { Sql } from '../../src/shared/db/client.js';
import { PgAccountRepository } from '../../src/modules/accounts/infrastructure/pg-account-repository.js';
import { PgRateRepository } from '../../src/modules/rates/infrastructure/pg-rate-repository.js';
import { parseCsv } from './csv.js';
import { ImportError, mapAccounts, type MappedAccount } from './accounts-mapper.js';
import { mapRates } from './rates-mapper.js';

export interface ImportArgs {
  user: string;
  accounts: string | undefined;
  rates: string | undefined;
  recordedAt: string | undefined;
  dryRun: boolean;
  force: boolean;
}

/** Date, time and a zone; `Date.parse` alone would happily accept "2026-09-11" or "yesterday" in some runtimes. */
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

const VALUE_FLAGS = ['--user', '--accounts', '--rates', '--recorded-at'];
const BOOL_FLAGS = ['--dry-run', '--force'];

export function parseArgs(argv: string[]): ImportArgs {
  const values: Record<string, string> = {};
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (VALUE_FLAGS.includes(arg)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`${arg} needs a value`);
      values[arg] = value;
      i++;
    } else if (BOOL_FLAGS.includes(arg)) {
      flags.add(arg);
    } else {
      throw new Error(`Unknown option ${arg}`);
    }
  }
  const user = values['--user'];
  if (!user) throw new Error('--user <email> is required');
  const recordedAt = values['--recorded-at'];
  // Checked here, before anything touches the database: a mistyped date would
  // otherwise only surface as a Postgres error in the middle of the import.
  if (recordedAt !== undefined && !ISO_DATETIME.test(recordedAt))
    throw new Error(
      `--recorded-at must be an ISO datetime such as 2026-09-11T12:00:00Z, not "${recordedAt}"`,
    );
  return {
    user,
    accounts: values['--accounts'],
    rates: values['--rates'],
    recordedAt,
    dryRun: flags.has('--dry-run'),
    force: flags.has('--force'),
  };
}

/**
 * Numbers an imported name that is already taken by an account kept because it
 * has transfers, the way the mapper numbers collisions inside one import: two
 * accounts with the same name are indistinguishable in the list.
 */
export function avoidTakenNames(accounts: MappedAccount[], taken: string[]): MappedAccount[] {
  const used = new Set(taken);
  return accounts.map((a) => {
    if (!used.has(a.name)) {
      used.add(a.name);
      return a;
    }
    let n = 2;
    while (used.has(`${a.name} ${n}`)) n++;
    const name = `${a.name} ${n}`;
    used.add(name);
    return { ...a, name };
  });
}

export function renderTotals(
  accounts: MappedAccount[],
  rates: { base: string; date: string; value: string }[],
): string {
  return `${accounts.length} accounts, ${rates.length} rates`;
}

export function renderPlan(
  accounts: MappedAccount[],
  rates: { base: string; date: string; value: string }[],
): string {
  const lines = accounts.map((a) =>
    [
      a.name.padEnd(32),
      a.bank.padEnd(20),
      a.country,
      a.currency.padEnd(5),
      a.kind.padEnd(13),
      a.balance.padStart(16),
      `note ${a.note?.length ?? 0}`,
    ].join('  '),
  );
  return [...lines, renderTotals(accounts, rates)].join('\n');
}

class DryRun extends Error {}

export async function runImport(
  args: ImportArgs,
  sql: Sql,
  io: { log: (s: string) => void } = console,
): Promise<void> {
  const [userRow] = await sql<
    { id: string }[]
  >`select id from auth.users where email = ${args.user}`;
  if (!userRow) throw new ImportError('No user found for the given --user email');
  const userId = userRow.id;
  const known = new Set(
    (await sql<{ code: string }[]>`select code from currencies`).map((r) => r.code),
  );

  const accounts = args.accounts
    ? mapAccounts(parseCsv(await readFile(args.accounts, 'utf8')), { known }).match(
        (v) => v,
        (e) => {
          throw e;
        },
      )
    : [];
  const rates = args.rates
    ? mapRates(parseCsv(await readFile(args.rates, 'utf8'))).match(
        (v) => v,
        (e) => {
          throw e;
        },
      )
    : [];
  io.log(args.dryRun ? renderPlan(accounts, rates) : renderTotals(accounts, rates));

  const recordedAt = args.recordedAt ?? new Date().toISOString();
  try {
    await sql.begin(async (tx) => {
      const t = tx as unknown as Sql;
      const accountRepo = new PgAccountRepository(t);
      const existing = await accountRepo.list(userId);
      const kept: string[] = [];
      if (accounts.length > 0 && existing.length > 0) {
        if (!args.force)
          throw new ImportError(
            `User already has ${existing.length} accounts; pass --force to replace the ones without transfers`,
          );
        for (const a of existing) {
          const outcome = await accountRepo.delete(userId, a.id);
          if (outcome !== 'deleted') kept.push(a.name);
          io.log(`${outcome === 'deleted' ? 'removed' : 'kept (has transfers)'}: ${a.name}`);
        }
      }
      for (const { balance, ...data } of avoidTakenNames(accounts, kept))
        await accountRepo.create(userId, data, {
          amount: balance,
          recordedAt,
          note: 'Imported from spreadsheet',
        });
      if (rates.length > 0)
        await new PgRateRepository(t).upsertMany(
          rates.map((r) => ({ ...r, source: 'manual' as const, userId })),
        );
      if (args.dryRun) throw new DryRun();
    });
    io.log(args.accounts || args.rates ? 'Imported.' : 'Nothing to import.');
  } catch (e) {
    if (e instanceof DryRun) {
      io.log('Dry run: rolled back.');
      return;
    }
    throw e;
  }
}
