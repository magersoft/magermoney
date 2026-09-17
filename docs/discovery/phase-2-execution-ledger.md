# Phase 2 execution ledger

Source: SDD ledger for `docs/superpowers/plans/2026-09-11-phase-2-accounts.md` (spec `docs/superpowers/specs/2026-09-11-phase-2-accounts-design.md`). Rulings made during execution, in the order they were made, each with the cost accepted if the ruling turns out wrong; then every deferred minor, grouped by task; then plan errata found along the way. Mirrors `docs/discovery/phase-1-execution-ledger.md`.

## Rulings

- Work in the main checkout on `feat/phase-2-accounts`, no worktree — phase 1 ran the same way, the checkout was clean, and local Supabase/env files live here. Cost if wrong: none beyond a stray uncommitted file.
- Accept the bootstrap placeholder `repos: undefined` until the pg repositories land (Task 9 removes it). Cost if wrong: none — one intermediate commit boots but cannot serve.
- `AccountDetailPage` loads `TransferSheet` via `defineAsyncComponent` to break a static ESM import cycle between the `accounts` and `transfers` module indexes (same fix as the phase 1 profile↔rates cycle). Cost if wrong: one extra chunk.
- The plan's expected realised rate (0.8614076412) was arithmetically wrong; the correct value is 13723.27/15931.21 = 0.8614078905 — accept the implementer's corrected literal. Cost if wrong: none, verified by hand.
- Both amounts of a transfer must be greater than zero (spec §3 check constraints, `TransferError('non_positive_amount')`); the plan's property test allowing `received = 0` was the defect, fixed by constraining the generator (fee < sent) while keeping the guard on both amounts. Cost if wrong: a 100%-fee transfer would need a manual balance entry instead of a transfer.
- `UpdateAccountInputSchema` must not carry `.default(false)` on `isSpending` after `.partial()` — the default belongs on `CreateAccountInputSchema` only, so a PATCH without the field doesn't silently reset it; a test now asserts a bare `parse({ name: 'New' })` has no `isSpending` key. Cost if wrong: none.
- The bootstrap placeholder `repos: undefined` stands until Task 9 as pre-flight-ruled. Cost: the branch is not deployable between Task 5 and Task 9.
- Pg keyset pagination falls back to `coalesce((select created_at from balance_entries where id = cursor.id), 'infinity'::timestamptz)` when the cursor row was deleted, so same-`recorded_at` rows are still returned. Cost if wrong: one duplicated or skipped row on a page boundary right after a delete; phase 2 loads one page of 200 anyway.
- Every account route declares the full `ERRORS` set (400/401/404/409) so the `fail()` helper can narrow to a declared status without `any`; the delete-with-transfers (409 `account_has_transfers`) path gets a dedicated test seeding transfer counts through a custom `memoryRepos()`. Cost if wrong: slightly wider OpenAPI error lists.
- `editBalance` rejects a patched `recordedAt` earlier than the previous entry's with 400 `recorded_before_previous` — the edited entry must stay the latest, rather than silently reordering the journal. Cost if wrong: one more 400 the UI must explain.
- Fix three transfer concurrency/correctness defects found in review: (1) `updateTransfer` re-reads the transfer row _inside_ the lock, after `lockPair`, to avoid acting on stale amounts under concurrent PATCH — cost: one extra select. (2) a transfer must be the newest movement on both accounts: create returns 409 `transfer_not_latest` when `occurredAt` is earlier than either account's latest entry; update returns 409 `transfer_not_latest` when a changed `occurredAt` is earlier than the previous (second-newest) entry on either account — cost if wrong: a backdated transfer must be entered as manual balances instead. (3) a same-currency edit of `amountSent` alone keeps the stored fee (`received = newSent − oldFee`) instead of silently zeroing it — cost: none.
- Pg keyset ruling clarified: the `coalesce` belongs to the cursor tuple only — `(recorded_at, created_at, id) < (ts, coalesce(subq, 'infinity'), id)` — plus `user_id` added to both subqueries (lateral join and cursor lookup) and `reorder` uses 0-based `v.ord - 1` to match the interface. Cost if wrong: none.
- `MoneyInput`: fix the `invalid` flag never clearing on an external `modelValue` update, restore the dropped space in the `SPACES` regex, and accept a leading-dot fraction (`'.5'` → `'0.5'`). Cost if wrong: none. The fixed `h-12` height (exceeding the 44px touch target) is kept as-is.
- `useRecordBalance`'s `onSettled` uses plain `invalidateQueries` (default refetch) instead of `refetchType: 'none'`, so the UI reconciles with the server after recording a balance; the test's GET mock must reflect the POST's effect (a stateful mock) or be deferred like `use-profile.test.ts`. Cost if wrong: none.
- Web test fixtures with non-UUID ids (`'a'`, `'e'`) fail `z.uuid()` validation in the DTO schemas — a plan defect; implementers of the account/balance/transfer screens use UUID-shaped ids in fixtures instead. Cost: none.
- Local (and current cloud) Supabase issues ES256 JWTs via JWKS, not the HS256 secret spec §5 assumed; the API verifies via remote JWKS (ES256/RS256) from `SUPABASE_URL` first, with the HS256 secret kept only as a fallback for legacy projects. Cost if wrong: one extra verification branch.
- Break a `profile`↔`rates`-style import cycle risk by keeping to the module boundaries already fixed in phase 1; no new module needed in phase 2 (carried convention, not a new decision).
- Import mapping: `bank` = name minus a trailing ` <the row's own currency>` or ` Вклад`/` Инвест`, except cash rows, which keep their name — general on the row's own currency, not a fixed code list. Cost if wrong: a provider group split the owner fixes by renaming.
- The import's duplicate key stays `name + currency`, not `bank + currency`: the suffix exists to make displayed _names_ distinguishable, and rows whose names already differ (e.g. a card named "X Bank" vs. an account named "X Bank USD") need no suffix; spec §6 wording was amended in Task 19 to match. Cost if wrong: a few extra or missing suffixes the owner can rename.
- When suffixed import names still collide (same tier, or both tier-less), append ` 2`, ` 3`, … in row order so every imported name is unique. Cost: none.
- Imported balance entries persist the note `'Imported from spreadsheet'` (`OpeningBalance` gained an optional `note`, threaded through the pg and in-memory account repositories); the import's preview table prints only with `--dry-run` (a real run prints counts only); the missing-`--user` error no longer echoes the email and `import-sheet.ts` gets a top-level catch that prints only the message (no stack) and exits 1; `parseArgs` now rejects a flag whose value is missing or is itself another flag. Cost if wrong: none.
- Run the final whole-branch review before Task 18 (operational deploy) so production receives reviewed code; Task 18 executes after the final fix wave.
- Task 18 (public repo, cloud Supabase/Vercel projects, PR merge to `main`) executes now — explicitly authorised in the phase 1 interview; steps requiring the owner (Google OAuth client, GitHub Environment reviewer) are stopped and reported instead of attempted.
- Create only the `magermoney-prod` Supabase project now (fits the free tier); staging Supabase is deferred to the owner's decision. Preview deployments get no database until then; the e2e job stays gated on the `E2E_ENABLED` repo variable so PR CI stays green. Cost if wrong: one repo variable flip and a later staging `db.yml` run.
- The `api` Vercel project's SSO protection is disabled so previews stay reachable for smoke/e2e (the API is bearer-protected anyway); deploy switched to the Build Output API (`scripts/build-vercel.ts`) after two failed zero-config attempts. Cost if wrong: a script to maintain instead of zero-config.
- The balance and transfer sheets send `recordedAt` / `occurredAt` only when the person edited the date field; an untouched field is omitted so the server stamps the real "now" (create) or keeps the stored value (edit). Why: the `datetime-local` default has minute precision, so a truncated "now" could predate an entry made in the same minute and the new balance never became current (found by the local e2e run). Cost if wrong: none; the alternative (seconds in the input) is poor on a phone.
- The smoke scenario switches the display currency to USD before asserting totals, because new profiles default to EUR; it was a defect in the plan's scenario, not in the app. Cost if wrong: none.

### Final whole-branch review (rulings F1–F4)

- **F1 — offline mutations replay.** Mutations are retried only when the request never reached the API (a `fetch` rejection / `TypeError`, never an `ApiError` with a status), so an attempt made offline pauses and the retryer sends it on reconnect; `recordBalance` and `createTransfer` additionally got stable mutation keys whose defaults (request, optimistic patch, rollback, invalidation) are registered on the query client by the composition root, so a mutation dehydrated into IndexedDB is replayed after the cache is restored and the session is known. Why: spec §5's PWA line and Definition of Done §9.3 promise it, and a write lost in a lift is money the journal never hears about. Cost if wrong: a retried write could duplicate an entry if a server answer were ever misread as a network failure — hence the narrow `TypeError`-only rule — and a replayed mutation runs without its screen, so its optimistic patch has to live in the defaults, not in the composable.
- **F2 — API error codes map to their own messages.** One shared `shared/api/error-messages.ts` turns `ApiError.code` into an i18n key under the new `errors.*` namespace (identical key sets in `ru.json` and `en.json`), with each screen's generic message as the fallback; used by `RecordBalanceSheet`, `TransferSheet`, `AccountDetailPage` and `AccountFormPage`. Why: deleting a transfer-made entry claimed the entry was "not the latest", and `recorded_before_previous` showed the same wrong sentence. Cost if wrong: a code the map does not know falls back to the generic message, exactly as before.
- **F3 — balance writes take the account lock.** `recordBalance`, `editBalance` and `deleteBalance` run inside `deps.uow` and call `repos.accounts.lock(userId, [accountId])` before reading `latest()` or writing, with `assertEditable` inside that unit of work; `AccountDeps` and the account routes carry `uow`. Why: "is this still the latest entry" was decided outside any transaction, so a concurrent `recordBalance` could land between the check and the update. Cost if wrong: balance writes on one account now serialise, which costs a row lock per write and can queue two writes made in the same second.
- **F4 — `deleteAccount` is transactional.** The account row is locked first, then transfers are counted, then the row is deleted, all on the same transaction handle. Why: a transfer committing between the count and the delete tripped the foreign key and answered 500 (reproduced in `test/integration/pg-delete-account-concurrency.test.ts`). Cost if wrong: a delete racing a transfer now waits for it instead of failing fast.
- **Deviation from spec §5 recorded:** the account form shipped as `AccountFormPage`, a routed page at `/accounts/new` and `/accounts/:id/edit`, not the `AccountFormSheet` the spec named. Why: the form is long (card block, opening balance) and a bottom sheet on a phone leaves no room for it, and a routed page gives the browser's back button the job of closing it. Spec §5 was amended to name `AccountFormPage` (routed). Cost if wrong: one component move back into a sheet.

## Deferred minors

**Task 1** (transfer domain): `InsufficientFundsError.account` carries a currency code, not an account id (brief-mandated naming); `TransferErrorReason 'same_account'` unused until Task 8 wires it.

**Task 2** (read models): `ProviderGroup.country` comes from the first account of the bank — order-dependent if a bank spans countries.

**Task 3** (account contracts): `CursorQuery.before` regex accepts any 36-char `[0-9a-f-]` tail, not a strict UUID.

**Task 4** (migrations): SQL files are no longer formatted by lint-staged (`.sql` dropped from the prettier glob — no SQL plugin installed, a pre-existing gap); a SQL formatter choice is deferred.

**Task 5** (accounts application/in-memory): `createdAt` monotonic hack in `MemoryBalanceRepository.insert` is global, not per account (harmless); `has_transfers` outcome untested until Task 8's tests.

**Task 6** (account routes): eslint-disable on underscore destructures in `dto.ts` (consider `ignoreRestSiblings`); `patch as AccountPatch` cast.

**Task 7** (balance routes): 409 checked before the 400 future check (order unspecified by the spec); handler param named `id`.

**Task 8** (transfer routes): `listTransfers`'s `'?'` currency fallback can yield a wrong DTO; non-null assertion (`row!`) after `transfers.update`; `ERRORS`/`fail`/`json` helpers live in the accounts routes rather than shared; `dto.ts`'s `unwrapOr` swallows a derivation failure; redundant `TransferFailure | ConflictError` union in `update-transfer.ts`; `findById` called twice (pre- and post-lock).

**Task 9** (pg repositories): `PgAccountRepository.delete`'s count-then-delete is not transactional (the FK `restrict` backstops it); a malformed cursor becomes a 500 or an empty page; `in ()` on empty ids is latent; `pgUnitOfWork` commits on an `err` Result (doc comment only); the concurrency test doesn't assert the loser's error type; test pools never call `sql.end()`.

**Task 10** (rate repository): the pg-rate-repository integration test creates an auth user per test without teardown.

**Task 11** (`MoneyInput`): fixed `h-12` height rather than `pointer-coarse:min-h-11`.

**Task 12** (accounts application/web): create/update/archive/delete mutations both `setQueryData` and invalidate (one extra fetch); one review round left a rewritten reconciliation test non-discriminating until fix round 2 closed it.

**Task 13** (`AccountsPage`): `AccountRow` uses an unconditional `min-h-14` (plan-mandated); `accounts.noBalance` i18n key unused until Task 14; `unconvertibleCodes` computed inline.

**Task 14** (`AccountDetailPage`/forms): `RecordBalanceSheet`'s watch lacks `immediate`; `archive()` has no toast; the detail card's interpolation may leave a stray "·"; the timeline delta uses unscaled `toFixed()`; disabled `<button>` rows in the timeline (plan-mandated markup); `format.ts` uses explicit numeric date fields for `ru` (accepted deviation, ICU medium prints a longer string); a full `/impeccable` audit was skipped in favour of a manual pass (final review covered UI polish instead — possible residual polish gaps).

**Task 15** (`TransferSheet`/`TransfersPage`): no edit-mode/delete-error test for `TransferSheet`; a `'0.00'` fee isn't shortcut like `'0'`; the transfers list is fixed at `limit 200` with no pagination UI; a full `/impeccable` audit was never run on the new screens (manual pass only).

**Task 16** (`RatesPage`): the rate-row button lacks an `aria-label` naming its currency; a local `noContent` structural schema stand-in duplicated across `accounts-api`/`transfers-api`.

**Task 17** (import mapping): `mapRates` skips a parsed `'0'` like a blank value, and its single error names no row.

**Task 18** (import CLI/deploy): no test asserts the CLI's exit code for a missing `--user`; CI's integration job flaked once on port 54322 already in use (runner-side, not app-side) — consider a random db port or a retry.

**Task 19** (e2e/decisions/wrap-up docs): the smoke scenario's `selectAccountByName` helper matches an account by substring of its formatted `<select>` option label (`"<name> · <balance> <currency>"`), not by an exact account name.

## Plan errata

- Task 1: the plan's expected realised rate (0.8614076412) was arithmetically wrong; corrected to 0.8614078905 (13723.27/15931.21).
- Task 13: the plan's web test fixtures used non-UUID ids (`'a'`, `'e'`), which the zod DTO schemas (`z.uuid()`) reject; later tasks use UUID-shaped fixture ids instead.
- Task 17: the plan's bank-name regex no longer stripped a trailing currency code, breaking spec §6 grouping for rows like "X Bank USD"; the duplicate key was written as bank+currency instead of name+currency; two non-card duplicates both got the generic "· Account" suffix instead of distinguishing tiers. All three fixed in Task 17's fix round 1; spec §6 wording amended in Task 19.
- Task 18: Step 4 of the plan said "seven rows"; the fixture actually maps to 10.

## Not run

- Task 18 (deploy) was not run by the automated classifier for its cloud-provisioning side effects (public repo creation, push, cloud project creation, reading CLI tokens); it was handed to the owner with exact steps and completed manually — repo public, `main` protected, Supabase prod + migrations applied, Vercel ×2 projects with env configured, PR #1–#3 merged.
