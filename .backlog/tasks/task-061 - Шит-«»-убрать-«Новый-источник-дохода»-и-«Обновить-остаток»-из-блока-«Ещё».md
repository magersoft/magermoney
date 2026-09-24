---
id: TASK-061
title: 'Шит «+»: убрать «Новый источник дохода» и «Обновить остаток» из блока «Ещё»'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-23 18:39'
updated_date: '2026-09-24 09:58'
labels:
  - frontend
  - ux
dependencies: []
ordinal: 59000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
В шите быстрого действия (`apps/web/src/app/QuickActions.vue`) под формой каждого сегмента (Перевод / Расход / Поступление) висит блок «Ещё» с двумя кнопками: «Новый источник дохода» и «Обновить остаток». Они не связаны с выбранным сегментом, повторяются в каждом табе и отвлекают от основной записи. Источник дохода создаётся редко (есть экран /plan/income), остаток обновляют по конкретному счёту (уже есть в меню счёта на `AccountDetailPage`). Нужно решить, где этим действиям место, и убрать их из шита «+».
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 В шите «+» ни в одном сегменте нет блока «Ещё» с кнопками «Новый источник дохода» и «Обновить остаток»
- [ ] #2 Создать источник дохода можно из раздела Plan → Доходы (и, если нужно, из выбора источника в форме поступления) без шита «+»
- [ ] #3 Обновить остаток можно из экрана счёта; если нужен быстрый доступ без захода в счёт — выбрано и описано одно место для него
- [ ] #4 Выбранное размещение согласовано с владельцем до реализации (/frontend-design)
- [ ] #5 Тесты QuickActions и e2e обновлены; ключи i18n `quick.record`, `quick.incomeSource` удалены или перенесены
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Placement agreed with the owner 2026-09-24: balance is updated only from the account screen (AccountDetailPage already has it); a new income source lives in Plan → Income and the inflow form's source picker (both exist).
2. Remove the #secondary content and the account-picker sheet from QuickActions; drop the dead #secondary pass-through in OperationSheet and the three operation sheets.
3. Drop i18n keys quick.record, quick.incomeSource, quick.pickAccount (ru/en).
4. Update quick-actions tests (red first: assert no secondary block in any segment) and e2e.
5. lint/typecheck/test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Owner chose 'account screen only' for record-balance quick access (no extra entry point).
<!-- SECTION:NOTES:END -->
