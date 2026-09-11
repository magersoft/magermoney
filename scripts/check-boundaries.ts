/**
 * Proves the architecture rules are live.
 *
 * A lint rule that silently stops matching is worse than no rule, and
 * `eslint-plugin-boundaries` fails open: a pattern that matches nothing, a
 * dependency that cannot be resolved, or a config key the installed major no
 * longer reads all produce a clean run. So each fixture in `tools/lint-fixtures`
 * is linted under the path it pretends to live at — an element is decided by
 * where a file is — and this script fails if eslint is happy with any of them.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

interface Fixture {
  /** The fixture file, relative to the repository root. */
  file: string;
  /** Where eslint is told it lives, which is what puts it in an element. */
  lintedAs: string;
  /** What the rule is expected to complain about. */
  rule: string;
  why: string;
}

const FIXTURES: Fixture[] = [
  {
    file: 'tools/lint-fixtures/domain-imports-contracts.ts',
    lintedAs: 'packages/domain/src/__boundary_fixture__.ts',
    rule: 'boundaries/dependencies',
    why: 'the pure model may not depend on the wire contracts',
  },
  {
    file: 'tools/lint-fixtures/shared-imports-app.ts',
    lintedAs: 'apps/web/src/shared/__boundary_fixture__.ts',
    rule: 'boundaries/dependencies',
    why: 'shared code may not reach up into the composition root',
  },
];

let failed = false;

for (const fixture of FIXTURES) {
  const source = readFileSync(new URL(fixture.file, `file://${ROOT}`), 'utf8');
  const eslint = spawnSync(
    'npx',
    ['eslint', '--no-color', '--format', 'json', '--stdin', '--stdin-filename', fixture.lintedAs],
    { cwd: ROOT, input: source, encoding: 'utf8' },
  );

  const messages = JSON.parse(eslint.stdout || '[]')
    .flatMap(
      (result: { messages: { ruleId: string | null; message: string }[] }) => result.messages,
    )
    .filter((m: { severity?: number }) => m.severity !== 1);
  const matched = messages.some((m: { ruleId: string | null }) => m.ruleId === fixture.rule);

  if (matched) {
    console.log(`ok   ${fixture.file} — ${fixture.rule} fired (${fixture.why})`);
    continue;
  }

  failed = true;
  console.error(
    `FAIL ${fixture.file} — expected ${fixture.rule} to fire (${fixture.why}), got:\n` +
      (messages.length
        ? messages
            .map(
              (m: { ruleId: string | null; message: string }) => `       ${m.ruleId}: ${m.message}`,
            )
            .join('\n')
        : '       no errors at all'),
  );
  if (eslint.stderr.trim()) console.error(eslint.stderr.trim());
}

if (failed) {
  console.error('\nThe boundary rules are not enforcing anything. Fix eslint.config.js.');
  process.exit(1);
}

console.log(`\n${FIXTURES.length} boundary rules verified.`);
