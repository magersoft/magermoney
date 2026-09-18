# Phase 3 execution ledger

Source: SDD ledger for `docs/superpowers/plans/2026-09-17-phase-3-income-expenses.md` (spec `docs/superpowers/specs/2026-09-17-phase-3-income-expenses-design.md`). Rulings made during execution, in the order they were made, each with the cost accepted if the ruling turns out wrong; then every deferred minor, grouped by task; then plan errata found along the way. Mirrors `docs/discovery/phase-2-execution-ledger.md`.

## Rulings

- Work in the main checkout on `feat/phase-3-income-expenses`, no worktree — phases 1 and 2 ran the same way and local Supabase/env files live here. Cost if wrong: none beyond a stray uncommitted file.
- A fifth web module, `plan`, is added beyond the spec's list (`income`, `expenses`, `budgets`, `dashboard`): the Plan screen composes three data modules, and hosting it in any one of them would make that module import its siblings' screens. It owns no data, like `dashboard`. Cost if wrong: one small folder to fold back.
- An `activeTo` earlier than `activeFrom` is refused with 400 `active_period_invalid` on sources, expenses and budgets (the spec names only the database check). Cost if wrong: one more code the UI explains.
- The expense form's category field is a text input backed by a `<datalist>` and resolved by case-insensitive name: a known name sends `categoryId`, anything else sends `categoryName`. Spec §5 says "combobox with create-on-type"; this is that behaviour without a popover on a phone keyboard. Cost if wrong: swap in the shadcn Combobox behind the same `data-testid`.
- The dashboard takes "today" from the device (`todayIso()`, UTC date) like the rest of the web app, not from an injected `Clock`; `buildDashboard` takes `today` as a parameter so tests pin it. Cost if wrong: around midnight UTC the countdown can be a day off for a few hours, the same drift the rates table already has.
- `capital-total` stays the test id of the home screen's headline number, now on the dashboard's capital block, so the phase 2 smoke assertions hold unchanged. Cost: none.
- The inflows block draws its progress rule from `Decimal.toNumber()` ratios. This is drawing, not arithmetic (ADR 0001 is about amounts); no sum or comparison uses the float. Cost if wrong: none visible.
- Russian count forms for "N дней до зарплаты" come from `ruPlural` in `app/i18n.ts` (Task 19), three forms; "payday today" is a separate key. Cost if wrong: none.
- `BalanceEntryDto` gains `inflowId: string | null`; an `origin = 'inflow'` entry is labelled in the journal and cannot be edited or deleted there (409 `entry_not_manual`). Cost if wrong: none, the field is additive.
- Extra 400 codes beyond spec §4, so the UI can say what is wrong instead of a generic validation message: `active_period_invalid`, `negative_amount`, `rate_out_of_range`, `pay_days_invalid`, `non_positive_amount`, `rate_not_positive`, `credited_without_account`, `category_required`, `category_ambiguous`. Cost if wrong: unused message keys.
- An Inflow moved to another Income source by `PATCH` keeps its own currency; the source's currency is only the default at creation. Cost if wrong: a source can list an Inflow in a foreign currency, which the read models already convert.
- Editing a cross-currency credited Inflow's amount, currency or Account requires `creditedAmount` to be sent again (400 `credited_amount_required` otherwise); a same-currency edit re-credits by itself. Nothing is converted on the person's behalf (ADR 0002). Cost if wrong: one more field to retype in the sheet, which the web pre-fills.
- Editing a credited Inflow deletes its Balance entry and inserts a new one, so the entry's id changes; nothing else refers to that id. Cost if wrong: a cached journal row flickers on refetch.
- Changes of the primary Income source are serialised per user with a transaction-scoped advisory lock taken before `clearPrimary`, so two concurrent `PATCH`es both succeed and the later one wins, instead of one failing on the partial unique index with a 500. Cost if wrong: one extra lock round-trip per primary change.
- Task 19 ships stub `DashboardPage` and `PlanPage` screens (and stub `ExpenseFormPage` / `BudgetFormPage` barrels on `shared/layout/PendingPage.vue`) so every route resolves from the moment the shell changes; Tasks 23–26 replace them and the last of them deletes `PendingPage.vue`. Cost if wrong: a few commits in the middle of the branch show a bare heading on Home and Plan.
- Import: `--currency-of` and `--as-budget` match the name as the sheet spells it (whitespace collapsed), before "Подписка" or "(year…)" is stripped; an `--as-budget` name that matches no row stops the run. Cost if wrong: a retyped flag.
- Import: a source known only from inflows whose RUB and USD columns tie takes `--fallback-currency` and is marked `ambiguous`; unless that currency is RUB or USD the run stops and names the `--currency-of "<source>=RUB|USD"` flag to pass. Cost if wrong: one more flag on the first run.
- Import: inflow rows with a zero or missing amount, or a RUB row without its USD/RUB rate, stop the run and are listed; expense rows whose three amounts are all zero are skipped. Cost if wrong: a sheet row to fix before importing.
- Import: under `--force` a source that survives because one of its inflows was credited to an Account is reused by name, its gross amount, tax and commission are refreshed from the sheet, and a currency mismatch stops the run. Cost if wrong: a hand-edited gross amount is overwritten by the sheet's.
- Import: every mapping problem of all three sheets is collected and printed together; database-dependent refusals are still reported one at a time. Cost: none.
- Import: the totals line always names all six kinds, which changed three phase 2 assertions in `run.test.ts`. Cost: none.
- `BalanceEntryDto.inflowId` and its api dto placeholder (`inflowId: null` until the inflows column lands), plus the two web fixtures, were added in Task 6 at the controller's request instead of Task 10 as the plan places them; Task 10 completes the remaining fixtures. Cost if wrong: none beyond a redundant edit.
- The read-model parameter is named `table` (as `read-models.ts`) where spec §2 writes `rates` — kept `table`. Cost if wrong: a rename.
- `inflows.income_source_id`, `inflows.account_id` and `expenses.category_id` use `on delete no action` instead of the spec's `restrict` — Postgres checks a `restrict` FK immediately inside the nested statement that a `profiles` delete cascades through, so deleting a user failed once `income_sources`/`accounts`/`expense_categories` rows cascaded before their dependent `inflows`/`expenses` rows did; `no action` refuses a direct delete of the parent identically (the API's 409s are unaffected) but defers the check to the end of the statement, so the profile cascade completes. Cost if wrong: a stray FK violation surfaces at statement end instead of immediately, which is only observable in `EXPLAIN`, not behaviour.
- `balance_entries.inflow_id` got a partial UNIQUE index (not just an index) so one balance entry per credited inflow is enforced in the database, matching the ADR 0002 invariant. Cost if wrong: a legitimate case needing two entries per inflow would need the index dropped; none is known.
- Import (Task 17): the manual verification of Step 5 wrote its three synthetic demo CSVs to a scratch directory outside the repository instead of `imports/demo-*.csv`, so nothing ever read or wrote inside the git-ignored `imports/` tree; the README keeps the `imports/…` paths as the placeholders they are. The run itself was against local Supabase only, with a throwaway `@test.local` user created through the local admin API and deleted afterwards. Cost if wrong: none.
- Import: a forced inflows import is refused outright while any inflow of the user is still credited to an Account — `--force` deletes only uncredited inflows, so the credited ones would survive and the sheet's rows would be inserted beside them, and nothing distinguishes a duplicate from a genuine second receipt. The count is taken before any delete and the message names the way out (un-credit or delete them in the app, or run without `--inflows`). Cost if wrong: one more manual step for the owner before a re-import.
- Import: the README says plainly that forcing the expenses kind deletes every expense and every budget of the user and then every expense category left without an expense — after such a run that is all of them, including categories created in the app and their sort order. The behaviour is the plan's; only the wording changed, so the owner is not surprised by it. Cost if wrong: none.
- Task 18: the shadcn-vue CLI's collateral edits were reverted, keeping only the two generated `switch` files — `bunx shadcn-vue@latest add switch` also prepended a Geist Google-Fonts `@import` and a duplicate `@layer base` to `packages/ui/src/styles/index.css` (the direction says fonts are loaded by the app, and the base layer already exists), and bumped `@vueuse/core` `^14.4.0` → `^15.0.0` and `@lucide/vue` `^1.45.0` → `^1.47.0` in `packages/ui/package.json` + `bun.lock`. A primitive should not carry a font or a dependency major. Cost if wrong: the next `shadcn-vue add` in this package re-applies the same edits and has to be reverted again.
- Task 18: `ProgressRule` settles its fill with `transform: scaleX()` + `duration-base ease-out-quart motion-reduce:transition-none` instead of the brief's `transition-[width] duration-300 ease-out` — the `/animate` skill's hard rules are transform/opacity only and "extend the codebase's tokens, don't fork them", and an animated `width` relayouts every frame. The rendered result is the same rule filling in; `aria-valuenow` is unchanged. Cost if wrong: on a 2px hairline the `rounded-full` cap is scaled horizontally, which is invisible at that height.
- Task 18: a `SegmentedControl` segment truncates its label (`min-w-0 truncate`) rather than letting the row grow — the Russian labels of the Plan screen are longer than the English ones and three of them must fit a 360px phone. Cost if wrong: a very long label reads as an ellipsis; the caller shortens the word.
- Task 18: `ProgressRule` draws its fill in ink (`bg-foreground`) and takes no colour prop, although `docs/design/direction.md` lists "goal progress" among the changes that may take colour — the phase 3 screens draw several rules at once (the inflows-vs-plan rows) and spend colour on the month-plan remainder figure instead, so a neutral rule keeps those screens calm. A later phase that needs a tinted rule (goals) adds a `tone` / `fillClass` prop then. Cost if wrong: one prop added later.

- Task 19: a module barrel that fails to load triggers a full-page navigation to the target (`router.onError` + `isChunkLoadError`), in addition to the per-screen Reload fallback the spec names — the barrel import fails before any `routeComponent` exists to catch it, so the person would otherwise sit on a dead link. Cost if wrong: a genuine non-chunk error inside a barrel would reload once before showing itself.
- Task 19: a tab stays lit by path prefix (`/transfers` lights Accounts, `/settings/rates` lights Settings) rather than by vue-router's `isActive`, which only follows nested records and would light nothing on a flat route. Cost if wrong: a future route under a prefix lights a tab it does not belong to; the `owns` list is one line per tab.
- Task 19: the wordmark in the header is rendered `custom` without `aria-current`, so on `/` only the Home tab claims to be the current page. Cost if wrong: none; the link still navigates home.
- Task 19: below `sm:` the currency switch drops its currency codes to the screen reader (`max-sm:sr-only`) only when there are more than two reporting currencies — with three or four, the codes, the new rates link and the theme button do not fit a 375px header. At 320px with four currencies the header is still ~30px over and the switch compresses; 320px with four reporting currencies is out of the design target (`docs/design/direction.md` sets 375px). Cost if wrong: on a phone with 3–4 currencies the segments are identified by their currency mark alone.

- Task 19 (fix round 1): the full page load a failed barrel triggers is spent once per path, recorded in `sessionStorage` so the marker outlives the reload, and cleared by `router.afterEach`; a second failure for the same path is left to surface so `RouteError` renders. If `sessionStorage` refuses to store anything there is no way to bound the loop, so nothing reloads at all. Cost if wrong: in a browser without session storage a genuinely stale precache shows the error screen instead of curing itself.

- Task 20: `toInflow` takes the Account's currency as an optional third argument, because `InflowDto.creditedAmount` carries no currency; without it the domain object's `creditedAmount` is null.

- Task 21: `InflowRow.vue` is built in this task, not deferred to Task 22 — the brief's own file list and the `inflow-row-<id>` assertion of `IncomeSourcePage.test.ts` both require it, while the dispatch note grouped it with the Task 22 sheet. Task 22 builds `InflowSheet` only and reuses this row. Cost if wrong: Task 22 finds the component already there.
- Task 21: the ended-sources list is drawn at full contrast instead of the brief markup's `opacity-70` — 12px muted text at 70% opacity falls under AA in dark mode, and the disclosure already says the rows are ended. Cost if wrong: an ended source reads as loud as a current one until the person collapses the disclosure again.
- Task 21: the ended-sources toggle carries `aria-controls` only while the list is expanded, because the list is `v-if`-ed away when collapsed and a dangling `aria-controls` points at nothing. Cost if wrong: none; `aria-expanded` still tells the state.

- Task 22: `useCreateInflow().create` resolves `'sent' | 'parked'`, like the other parked writes, not the DTO. Cost if wrong: a caller that wants the created inflow reads it from the cache instead.
- Task 22: a source created from the inflow sheet starts on the inflow's date (today unless the date was changed), so a backdated first receipt is inside its active period. Cost if wrong: a source's `activeFrom` is earlier than the person would have typed.
- Task 22: creating that source is not parked offline — only the inflow itself is; offline, "New source…" fails with the generic message and keeps the sheet open with everything typed. Cost if wrong: an inflow from a brand-new source cannot be recorded without a connection.
- Task 22: the quick-action button now shows with zero accounts, because an inflow needs none; balance and transfer stay hidden until an account exists. Cost if wrong: an empty-handed person sees one action instead of none.
- Task 22: a parked inflow refused as another account's write skips the snapshot rollback and relies on the refetch (closes the matching phase 2 follow-up for this mutation only). Cost if wrong: the optimistic row stays on screen until the refetch answers.
- Task 22: the source picker is locked when editing an inflow; moving a receipt to another source is delete-and-recreate. Cost if wrong: one extra step for a misfiled receipt.
- Task 22: the "credited" block fades in with an inline 150ms linear opacity transition rather than a `packages/ui` preset — `fadeUp`/`scaleIn` both move, and a second movement inside a sheet that is already sliding reads as the form jumping. The values are the ones the presets use for their own fades. Cost if wrong: one more place to change if the fade duration is ever retuned.
- Task 22: `inflows.hint` reads "По курсу дня ≈ {amount}" (capitalised), not the brief's lowercase "по курсу дня", so it matches the sibling `transfers.hint` the person sees in the transfer sheet. Cost if wrong: none.
- Task 22: the "More" disclosure keeps its fields in the DOM with `v-show` instead of `v-if`, so the button's `aria-controls` always points at an element that exists. Cost if wrong: two fields are parsed but hidden while the disclosure is closed.
- Task 22 (fix round 1): a credited amount is cleared whenever the chosen account or the source's currency changes, and Save waits for it to be typed again — the brief's form kept the value across an account change, so a number typed for euros could be submitted as pounds. A declared balance must never carry a number typed for another currency. Cost if wrong: one number retyped after a change of mind.

- Task 23: the expense form uses native `<select>` elements for currency, period and billing month, not the brief's shadcn `Select`/`SelectTrigger`/`SelectValue`. `IncomeSourceFormPage.vue` — the sibling form and the pattern web-common points at — already chose native selects with a comment saying why (the e2e drives them with `selectOption`, and on a phone the platform picker wins), and reka-ui's `SelectValue` renders nothing for a value chosen before its content has mounted, so the default "Каждый месяц" would show as an empty trigger. The `data-testid`s of the brief are kept. Cost if wrong: two forms to convert together the day the project moves to the shadcn Select.
- Task 23: the Expenses segment keeps an "Добавить расход" button in the non-empty state as well, not only in the empty state the brief's markup gives it — otherwise a person with one expense has no way to add a second. It is the same outline button, in the same place, as `IncomeSegment.vue`'s. Cost if wrong: one extra button on the Plan screen.
- Task 23: a row's converted amount (the 12px line under the mono figure) is drawn only when the expense's currency differs from the display currency; in one currency it printed the same number twice on every row. The group and footer totals are unconditional. Cost if wrong: a single-currency ledger loses a line that said nothing new.
- Task 23: the ended-expenses `<ul>` is always rendered and hidden with `[hidden]` (its `<li>`s come from a computed that is empty while collapsed), so the toggle's `aria-controls="ended-expenses"` always points at an element that exists — the Task 21 income segment solved the same problem the other way, by dropping `aria-controls` while collapsed, and the brief's own segment test requires the attribute before expanding. Cost if wrong: an empty `<ul>` in the DOM.
- Task 23: expense row name and amount are set at 16px (`text-base`) rather than the brief markup's `text-[15px]`, which is off the type scale `docs/design/direction.md` fixes (12/13/14/16/20/24/32/44). Cost if wrong: rows are 1px looser than the brief imagined.
- Task 23: `expenses.ended.show` keeps the brief's "Завершённые ({n})" although the income segment next to it says "Завершённые · {n}"; the brief's copy is verbatim requirement, and the two strings will be seen on the same screen. Cost if wrong: one inconsistent separator between two tabs of the Plan screen.

## Deferred minors

(grouped by task as they arise)

### Task 5

- `monthlyAmount(e)` computed twice per essential expense in `plan-read-models.ts`.
- `days` unvalidated in `upcomingEvents`.
- The property test never draws an unconvertible currency.
- Expense `refId` not asserted in the upcomingEvents test.
- `inflowsVsPlan` row order is the caller's (doc line).

### Task 6

- `.default(null)` on the output DTO `BalanceEntryDtoSchema.inflowId` is a back-compat shim, worth a one-line comment.

### Task 17

- `renderInflows` prints "1 inflows" for a single-inflow source; the plural is not chosen.
- Income source names are matched case-sensitively (`sourceIds` keyed by the raw name) while expense categories are matched case-insensitively; the two could agree.
- The phase 2 `--force` path still prints account names in its `removed: …` / `kept (still referenced): …` lines, unlike the phase 3 kinds, which print counts only.

### Task 18

- `motion-reduce:transition-none` on the `ProgressRule` fill is redundant with the global reduced-motion catch-all in `styles/index.css`, which already zeroes `--mm-duration-*`.
- `SegmentedControl` moves keyboard focus by walking `parentElement.children` instead of template refs, which assumes the segments are the group's only children.

### Task 19

- The rates link lives inside the currency switch, which is hidden when a profile has a single reporting currency — such a profile has no header route to the rates screen at all, only the Settings row.
- `FAB_PATHS` gained `/accounts`, and no test covers where the FAB appears; the phase 2 suite never asserted it either.
- `settings.currencies.hint` still says "на главной" / "home screen" while the totals it describes now live on `/accounts`; Task 26 revisits the copy once the dashboard carries them.
- The e2e smoke test is still titled "sign in, see home, switch currency" but no longer visits home; Task 27 restores the home leg and the title with it.
- `SettingsPage.test.ts` asserts the link by finding the `RouterLinkStub` whose `to` is `/settings/rates`; a failure reads as `undefined`, and naming the cause (assert the row exists, then its target) would say what broke.

### Task 21

- The "is this source ended" predicate is spelled twice — `activeTo === null || activeTo >= today` in `IncomeSegment.vue` and `isCurrent` in `IncomeSourcePage.vue`; it belongs next to `payDaysLabel` in `domain/labels.ts`.
- The amount lockup (a padded figure plus its code in mono small-caps) is hand-rolled in four places now; a small `AmountLockup` in `packages/ui` would make the signature device one object.
- `InflowRow` prints `inflow.amount` as the API sends it while `IncomeSourceRow` pads to the currency's scale, so a ledger can show `500` above `765.00`.
- The day grid is labelled twice: a `<legend>` on the fieldset and `aria-label` on `DayOfMonthPicker`; a screen reader reads the group name twice.
- The delete dialog's Cancel and confirm buttons keep the shadcn defaults and have no `pointer-coarse:min-h-11`, unlike every other control on these screens.
- Test gaps: the exact `activeTo` value sent by "End today", the error toasts of `end`/`del`/`submit`, the loading skeletons, and that `source-end` is hidden on an already-ended source.
- The inflows list on the source page is rendered in the order the API returns it (newest first); nothing on the client asserts or enforces that order.

### Task 22

- Offline, "New source…" shows the generic retry copy (`inflows.failed`) instead of the offline copy: only the inflow itself is parked, and the sheet cannot tell a dead connection from a refused write.
- No sheet-level test for `create() → 'parked'` closing the sheet and toasting `offline.saved`; the parked path is covered at the mutation level only.
- The lazily imported `InflowSheet` in `QuickActions.vue` has no error fallback: a failed chunk leaves the quick action doing nothing, unlike the routed screens, which have `routeComponent`.

## Plan errata

(defects found in the plan's code or expected values, with the correction)

- Task 8's file list did not mention `apps/api/test/integration/pg-balance-concurrency.test.ts`, which builds a `Repos` object literal by hand; extending `Repos` with `incomeSources` broke its typecheck. Fixed by adding `incomeSources: repos.incomeSources` to that literal.
- Same for Task 9: extending `Repos` with `inflows` broke that same hand-built literal in `pg-balance-concurrency.test.ts`. Fixed by adding `inflows: repos.inflows`.
- Same for Task 11: extending `Repos` with `expenseCategories` and `expenses` broke that same hand-built literal in `pg-balance-concurrency.test.ts`. Fixed by adding both to it.
- Same for Task 12: extending `Repos` with `budgets` broke that same hand-built literal in `pg-balance-concurrency.test.ts`. Fixed by adding `budgets: repos.budgets`.
- 400 `active_period_invalid`, `negative_amount`, `category_required`, `category_ambiguous` added to the expenses API beyond spec §4, so table checks never surface as 500; over HTTP the Task 6 contracts answer `VALIDATION` first for anything wrong within one payload, and these codes appear only when the merged row of a PATCH is wrong (or for callers that bypass zod).
- Task 13's brief gives `const [{ count }] = await sql<{ count: number }[]>...` twice in `pg-inflow-credit-concurrency.test.ts`; under this repo's `noUncheckedIndexedAccess`, destructuring an array element directly types it as possibly `undefined`, so `tsc --noEmit` refuses the nested-object pattern. Fixed by destructuring the row (`const [row] = await sql...`) and reading `row!.count`, matching the `!`-after-single-row pattern already used elsewhere in `test/integration/`.
- Task 13's brief text for "two simultaneous credits to one account both land" only asserted `landed.length >= 1` and derived the expected balance from whichever result happened to land. The production path (`createInflow` takes the account lock before reading the balance; `planCredit` stamps `recordedAt` after the lock is held) makes both concurrent credits succeed deterministically — one is never refused as `credit_not_latest`. Task 13's fix-round-1 review asked for the stronger assertion (`results.every(r => r.isOk())`, the exact summed balance, and exactly one `balance_entries` row per inflow), which is what the test now checks.
- Task 17's fixture and its expected dry-run line used the date `10.02.2025` / `2025-02-10`, which coincides with a date in the owner's private sheet; replaced with `21.03.2025` / `2025-03-21` in `run-phase3.test.ts` and in the plan's Task 17 text (the same substitution Task 15 already made in its own fixture).
- Task 18's Step 2 expects "the six older test files still pass": `packages/ui/test` held four test files before this task (`CurrencyIcon`, `icon-registry`, `money-input`, `resolve-icon`), so the run is 4 older + 6 new = 10 files, not 12.
- Task 18's Step 3 warns only that the shadcn-vue CLI may edit `package.json`. It also edits `src/styles/index.css` (adds a Geist Google-Fonts `@import` and a `@layer base` block) and bumps dependency majors; all of that has to be reverted after the `add`, keeping only `src/components/ui/switch/**`.

- Task 19's `test/route-fallback.test.ts` mounts the async component as the mount root and resolves its loader to a bare `{ default: Page }`. Neither works: `@vue/test-utils` 2.5 leaves `wrapper.vm` null for an async root (every `get`/`text` throws `Cannot read properties of null`), and Vue only unwraps `default` when the resolved object carries `__esModule` (a real `import()` does, a literal does not), so the test's own component never rendered. Fixed by rendering the screen from a one-line host component and marking the resolved module `__esModule: true`.

- Task 22's `use-create-inflow.test.ts` awaits the create promise while every GET is still blocked. It cannot resolve: `onSettled` returns `invalidateAfterInflow`, and the mutation settles only after that invalidation's refetch of the (active) accounts and inflows queries has answered, so the test timed out at 5s. Fixed in the test, not the implementation: the blocked GETs are collected and released with their normal answers after the rollback has been asserted, so the rollback is still proven to come from `onError` and the write is then awaited as every caller awaits it.
- Task 22's `InflowSheet.test.ts` gives `api()` a default parameter `sources = [{ ...sourceDto, defaultAccountId: USD_ACC }]`, which infers `defaultAccountId: string` and makes the second test's `api(calls, [sourceDto])` (`defaultAccountId: null`) a type error under `vue-tsc`. Fixed by typing the parameter explicitly.
- Task 23's Step 9 form imports `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` from `@magermoney/ui`; the repo's own form pattern (`IncomeSourceFormPage.vue`, Task 20) deliberately uses native `<select>` elements for the same three kinds of choice. Native selects were used, keeping the brief's `data-testid`s.

## Not run

(anything the plan asked to run that could not be run here, and why)

- Task 19: `apps/web/e2e` (Playwright). Its two `page.goto('/')` calls before a `capital-total` assertion were moved to `/accounts`, but the suite was not run — it needs a browser binary and a live Supabase plus `E2E_*` env.
- Task 23: the `/impeccable` pass at 390px and desktop, light and dark, was done by reading the markup against `docs/design/direction.md` and the skill's checklist, not in a browser — `ExpensesSegment` has no host screen until Task 25 mounts it on the Plan screen, and the form route needs a live Supabase session. The findings it produced are in the Rulings above.

## Known follow-ups after the final review

- The plan commit b23a89d carried three real inflow dates in the Task 15 fixture (replaced in this commit); squash-merge the PR so main does not carry them.
- Spends and month close, Snapshots, Goals, Assets, the yearly-history import: phases 4–5.
- Offline parking covers record-balance, create-transfer and create-inflow only; edits and deletes still wait for the network (carried from phase 2).
- Idempotency keys for replayed writes (carried from phase 2): a lost response can make a replayed inflow appear twice.
- "Received this month" converts past Inflows with today's rates; historical-rate conversion belongs to phase 5 analytics.
- The phase 2 `transfers` FKs (`from_account_id`, `to_account_id` on `public.accounts`) still use `on delete restrict`, unlike the three phase 3 FKs moved to `no action` for the profile-cascade fix above; revisit if a future migration nests a cascade through `transfers`.
