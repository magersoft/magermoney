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
