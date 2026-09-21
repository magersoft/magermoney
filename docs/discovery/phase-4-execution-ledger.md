# Phase 4 execution ledger

Source: SDD ledger for `docs/superpowers/plans/2026-09-21-phase-4-goals-assets.md` (spec `docs/superpowers/specs/2026-09-21-phase-4-goals-assets-design.md`). Rulings made during execution, in the order they were made, each with the cost accepted if the ruling turns out wrong; then every deferred minor, grouped by task; then plan errata found along the way. Mirrors `docs/discovery/phase-3-execution-ledger.md`.

## Rulings

- One branch, `phase-4`, for all sixteen tasks rather than one per backlog task. Tasks 4, 5 and 10 (contracts, migrations, pg integration) each serve TASK-031, TASK-032 and TASK-033 at once, so a branch per backlog task would mean cutting them into three and reordering the plan. Commits name the backlog task they belong to. Cost if wrong: the three tasks close on one merge instead of three.
- `GoalForecast` gains a fourth reason, `too_far`, with a horizon of `FORECAST_HORIZON_YEARS = 50`. The spec fixes only "never in the past" and "no forecast on a non-positive rate"; a rate that is positive but tiny against a large remainder answers with a year nobody plans around, and past year 9999 `addDays` stops returning an `IsoDate` at all — which is how the case was found, by the plan's own property test. Owner chose the explicit reason over folding it into `not_advancing` or clamping the date. Cost if wrong: one value out of the contract enum and two i18n strings.

- `achieved_at` is stamped from the linked Accounts that hold the Goal's **own** currency, and those alone (the plan's Task 7 note, adopted). No request path here has a rate table, and a stamp that depends on today's rate is a stamp a rate could take back. A Goal funded entirely in other currencies is stamped by the next same-currency write, or by its owner's own edit. Cost if wrong: a goal reached only across currencies shows unstamped until one of those two happens.

- `GoalForecast` gained `too_far` _and_ a correctness fix behind it: decimal.js calls zero positive, so the plan's `!rate.isPositive()` guard let a flat balance through and divided the remainder by zero. `gt(0)` is the guard; the flat case now says "not advancing", which is what it is. Cost if wrong: none — the previous behaviour printed a year in the tens of thousands.
- The goals and assets modules ship `offline.ts` with their query keys but no registered mutation. Nothing a goal does is written in a lift, and the write with the best claim — recording a valuation in front of the thing — is wired when TASK-036 gives edits and deletes a general home. Cost if wrong: a valuation typed offline is lost until then, the same as every other edit today.

## Deferred minors

- The valuation journal has no cursor pagination (TASK-033 AC #6 asks for it). An asset carries a handful of opinions, not a ledger, and the endpoint serves them newest-first in one response; pagination is wiring with no load to justify it yet. Left unchecked on the task.
- The five-tab pill was not proven at 320 px in a real browser, and the glass contrast proof was not re-run against the new geometry (TASK-031 AC #6). Both navigations are covered by tests at the DOM level, and the existing glass-panel suite passes unchanged, but neither is the visual check the plan asks for. Left unchecked.
- Task 5 step 4: `supabase db reset` was not run. The local database holds an import — 48 accounts, 84 inflows, 33 expenses — and the owner chose to keep it. The three migrations were applied to the running database instead, and all four constraints from step 5 were proven inside a transaction that was rolled back (a zero target refused, deleting a Goal released its Account, deleting an Asset took its valuations, a second valuation on the same day refused). The "applies from empty" proof stays on the hand-off checklist.

## Plan errata

- Task 1 and Task 3: the `Rate` literals in the test blocks omit `date` and `source`, both required by `packages/domain/src/rate.ts`. Written as the repo's own tests do, through a local `rate()` helper.
- Task 1: the plan's three test cases never reach the zero-target guard in its own implementation block, so the plan as written leaves the domain package's 100 % branch gate red. One case added.
- Task 4: the file list names only `packages/contracts`, but `goalId` on `AccountDtoSchema` is a required field on a schema three packages already parse against. It broke the API's `toAccountDto` at typecheck and 46 web tests at runtime, none of them in the task's list. `AccountRow` gained `goalId` (excluded from `NewAccount`, added explicitly to `AccountPatch`), both account repositories carry it, and every web account fixture gained `goalId: null`.
- Tasks 7 and 8 cannot be separated: every test the plan gives Task 7 links an Account to a Goal through `PATCH /accounts/{id}`, which Task 8 builds. Implemented and committed together.
- Task 7: its tests read the account back from `GET /accounts/{id}`, which this API does not have — only the list, a PATCH and a DELETE live on that path. Asserted through `GET /accounts`.
- Task 6: the test block imports `authHeader` and `USER` from `test/helpers/deps.ts`; neither exists. The repo's helper is `test/helpers/http.ts` with `authed(app, method, path, body, uid)`, `UID`, `OTHER` and `SECRET`, which every other API test uses. Rewritten against those.
- Task 5: the migrations are written in the plan with one `for all` RLS policy per table and `execute function`; every earlier migration in this repo uses four named policies `to authenticated` and `execute procedure`. Written the repo's way, which is also what the phase 4 RLS integration test will look for.
- Task 5 step 6: nothing to move. The three tables were already in the numbered `phase 4` section of `schema.dbml`, not in a speculative one — only the field edits applied (`monthly_share` and `income_source_id` dropped, `archived_at` added to `goals` and `assets`, notes filled in).
- Task 4: `goalId` belongs on `UpdateAccountInputSchema` only, not on the shared `accountFields` — that object also builds `CreateAccountInputSchema`, and nothing creating an Account has a Goal to name yet.
- Task 2: the expected forecast date `2026-10-15` is four days off. The implementation in the very next block defines a month as 30 days, and seven of those from 15 March land on 11 October.
