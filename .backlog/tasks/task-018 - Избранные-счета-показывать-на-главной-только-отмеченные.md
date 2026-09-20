---
id: TASK-018
title: 'Избранные счета: показывать на главной только отмеченные'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-19 13:03'
updated_date: '2026-09-20 08:05'
labels: []
dependencies:
  - TASK-012
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Сейчас полоса счетов на главной (AccountsStripBlock) показывает все неархивные счета подряд — она разрастается вместе с их числом, и главная перестаёт быть коротким обзором. У пользователя обычно есть два-три счёта, за которыми он следит каждый день, остальные нужны только в разделе Счета.

Нужен флаг счёта «показывать на главной» (по образцу существующего is_spending: колонка в accounts, поле в контрактах, переключатель в форме счёта), а главная должна читать только отмеченные счета. Флаг сквозной — миграция, контракты, API, форма счёта и главная.

Открытые вопросы для исполнителя: как вести себя, когда не отмечен ни один счёт (пустое состояние с подсказкой или мягкий фолбэк на все счета) — решение зафиксировать в плане задачи.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 В accounts есть булева колонка флага избранного со значением по умолчанию false, миграция применяется на чистой базе и на существующих данных
- [x] #2 Поле флага есть в схемах контрактов: в DTO счёта, в создании (по умолчанию false) и в частичном обновлении, где его отсутствие не подставляет значение
- [x] #3 API возвращает флаг в счёте и позволяет менять его через обновление счёта; use case фильтрует по userId
- [x] #4 В настройках счёта (форма счёта) есть переключатель избранного с понятной подписью: этот счёт будет показан на главной
- [x] #5 Полоса счетов на главной показывает только отмеченные счета, порядок сохраняется прежний
- [x] #6 Поведение при нуле отмеченных счетов определено и реализовано: пользователь видит понятную подсказку, как отметить счёт, а не пустую полосу
- [x] #7 В списке Счета отмеченный счёт визуально различим
- [x] #8 Строки локализации добавлены в en.json и ru.json
- [x] #9 Тесты покрывают: контракты (значение по умолчанию и частичное обновление), обновление флага через API, фильтрацию полосы на главной и пустой случай
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Naming: the flag is a Pinned account — column is_pinned, field isPinned, mirroring is_spending end to end. New vocabulary entry in CONTEXT.md.

Zero-pinned ruling: no soft fallback to all accounts. A fallback would silently undo the user's choice and make the flag look broken. With accounts but none pinned the strip shows a hint that says where to pin one and links to Accounts; with no accounts at all the existing 'no accounts yet' line stays.

1. Migration supabase/migrations/20260920000012_accounts_is_pinned.sql: alter table accounts add column is_pinned boolean not null default false. Existing rows get false (nothing pinned until the user says so).
2. packages/contracts/src/account.ts: isPinned in AccountDtoSchema and in accountFields (z.boolean()); create defaults it to false like isSpending; partial update leaves it absent. Test both in phase2.test.ts.
3. packages/domain/src/account.ts: isPinned on Account (the strip reads the domain object through CapitalSummary).
4. apps/api: AccountRow/NewAccount, toNewAccount, pg toColumns + SELECT, import mapper. Tests: PATCH toggles the flag and it comes back in the DTO.
5. apps/web: mappers toAccount, AccountFormPage switch (label 'this account shows on Home'), AccountRow marks a pinned account in the Accounts list.
6. apps/web dashboard AccountsStripBlock: filter the flattened capital groups by isPinned, keep the order; hint block for the none-pinned case.
7. Locale strings in en.json and ru.json (form label, accounts list marker, dashboard hint), humanized.
8. Tests: contracts, api accounts, web AccountFormPage/AccountsPage/DashboardPage (filtering + empty case). Run bun run test, lint, typecheck.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Naming: Pinned account (is_pinned / isPinned), a new CONTEXT.md entry next to Spending account. Avoided 'favourite' and 'primary' — the latter is the Income source's word.

Zero-pinned ruling: no fallback to showing every account. The strip tells the user where the switch is (dashboard.accounts.unpinned) and keeps the 'All' link to the Accounts screen; the add tile stays only for the genuinely-no-accounts case, since with an account already there the switch is what is off, not the account that is missing.

Migration verified outside the Supabase CLI (not installed here): applied every migration in order to a throwaway postgres:16 with auth/role stubs, then applied 20260920000012 twice over — once on the clean base, once with an accounts row already present. The existing row took is_pinned = false and an update to true stuck. The same database then ran PgAccountRepository.create/update/list directly: isPinned came back true, patched to false, and listed per account, so the SELECT and the toColumns mapping are exercised against real SQL.

Polish pass (/impeccable audit + detector, 0 findings): pulled the duplicated switch row into FormSwitchRow.vue rather than shipping a second copy of it, and grouped the pin with the currency mark at full ink — AccountCard's own rule is that all type on the tint is ink, and a 60%% pin would not clear the 3:1 WCAG 1.4.11 asks of a graphic.

Not done here: no live browser screenshot, the app needs a Supabase backend this environment has no credentials for. The behaviour is covered by mounted-component tests instead (AccountsStripBlock through DashboardPage, the card marker through AccountsPage and packages/ui).

Validation: bun run test (801 tests across 6 packages), bun run lint, bun run typecheck, bun run build — all green.
<!-- SECTION:NOTES:END -->
