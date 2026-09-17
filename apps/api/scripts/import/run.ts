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
  return {
    user,
    accounts: values['--accounts'],
    rates: values['--rates'],
    recordedAt: values['--recorded-at'],
    dryRun: flags.has('--dry-run'),
    force: flags.has('--force'),
  };
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
      if (accounts.length > 0 && existing.length > 0) {
        if (!args.force)
          throw new ImportError(
            `User already has ${existing.length} accounts; pass --force to replace the ones without transfers`,
          );
        for (const a of existing) {
          const outcome = await accountRepo.delete(userId, a.id);
          io.log(`${outcome === 'deleted' ? 'removed' : 'kept (has transfers)'}: ${a.name}`);
        }
      }
      for (const { balance, ...data } of accounts)
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
