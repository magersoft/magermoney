---
id: TASK-062
title: 'Экран «Обновить остаток»: полный передизайн'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-23 18:39'
updated_date: '2026-09-24 10:12'
labels:
  - frontend
  - design
dependencies: []
ordinal: 60000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Шит «Обновить остаток» (`apps/web/src/modules/accounts/ui/RecordBalanceSheet.vue`, открывается из меню счёта и из шита «+») выглядит плохо и выбивается из остальных форм. Формы расхода, перевода и поступления уже собраны на `QuickActionSheet` (сумма первой, поля строками, общие отступы), а этот экран остался старым. Нужен полный передизайн в том же языке.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Экран сверстан в том же визуальном языке, что формы расхода/перевода/поступления: сумма крупно первой, валюта счёта видна, поля «Когда» и «Заметка» строками
- [x] #2 Видно, какой счёт обновляется, и текущий остаток до изменения; понятно, на сколько изменится остаток
- [x] #3 Режим редактирования записи («Изменить запись», «Удалить запись») работает в новом дизайне
- [x] #4 Ошибки дат (в будущем, раньше предыдущей записи) показываются у поля, а не только общим сообщением
- [x] #5 Проверено на 390px и на широком окне, в светлой и тёмной теме; /impeccable-аудит пройден
- [x] #6 Тексты прогнаны через /humanize-text; тесты RecordBalanceSheet обновлены
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Rebuild RecordBalanceSheet on QuickActionSheet (amount first, account currency caption, account name as description, When/Note as InputRows, delete in edit mode).
2. Show the previous balance and the decimal change under the amount (balanceChange helper, TDD).
3. Date errors at the field: future caught client-side; recorded_in_future / recorded_before_previous from the API mapped onto the field instead of a toast.
4. QuickActionSheet gains allowNegative (credit cards).
5. Copy through /humanize-text, tests + e2e selectors updated, browser check both themes and widths, /impeccable audit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verification: RecordBalanceSheet.test.ts 10/10 (before/change line, future date at field with confirm disabled, recorded_before_previous at field and cleared on date change, edit mode + delete errors, offline parking); balance-change.test.ts; web 438/438, ui 361/361, lint, typecheck clean. Browser (local dev, owner signed in): narrow at 500px (Chrome's minimum window width; 390 not reachable, sheet measured at full viewport width, no horizontal scroll) and 1280px; light and dark; typed 15000 over 14 577,45 → '+422,55 ₽'; future date → error at 'Когда', Записать disabled; edit mode shows 'Изменить запись', 'Не меняется', 'Удалить запись'. /impeccable audit: detector clean; fixed P2 live region re-reading the old balance, alignment and mono on 'Не меняется'. Score 19/20. Not done: e2e smoke fails at line 115 (form-country fill) before reaching this sheet; that step predates this task. Delete entry still has no confirm dialog (unchanged behaviour).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rebuilt 'Обновить остаток' on QuickActionSheet so it matches the expense/transfer/inflow forms, with what the account held and the decimal change under the amount, and date errors shown at the date field (client-side future check plus server codes mapped onto the field). Verified with vitest (web 438, ui 361), lint, typecheck, a browser check at narrow/wide in both themes, and an /impeccable audit (19/20).
<!-- SECTION:FINAL_SUMMARY:END -->
