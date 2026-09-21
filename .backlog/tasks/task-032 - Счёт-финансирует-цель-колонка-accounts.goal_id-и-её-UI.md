---
id: TASK-032
title: 'Счёт финансирует цель: колонка accounts.goal_id и её UI'
status: Done
assignee:
  - '@magersoft'
created_date: '2026-09-19 13:23'
updated_date: '2026-09-21 13:39'
labels:
  - phase-4
  - api
  - web
  - db
milestone: m-0
dependencies:
  - TASK-031
references:
  - docs/db/schema.dbml
  - docs/superpowers/specs/2026-09-11-phase-2-accounts-design.md
  - CONTEXT.md
type: feature
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Счёт финансирует не больше одной цели, и это обеспечивает сама колонка accounts.goal_id — отдельного ограничения не нужно. Удаление цели счета не уносит: on delete set null. Привязка делается НЕ из формы счёта, а с экрана цели: кнопка «Добавить счёт» открывает шит, в котором перечислены только свободные счета, поэтому правило «одна цель на счёт» показывает себя само, без объяснений. Запись идёт через PATCH /accounts/{id} с полем goalId — колонка принадлежит таблице accounts, и модуль goals в чужую таблицу не пишет.

Спека: docs/superpowers/specs/2026-09-21-phase-4-goals-assets-design.md, §4 «Linking an Account». План: docs/superpowers/plans/2026-09-21-phase-4-goals-assets.md, задачи 5, 8, 14.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Миграция добавляет accounts.goal_id (nullable, FK на goals, on delete set null) без потери данных
- [x] #2 PATCH /accounts/{id} принимает goalId: привязывает, отвязывает по null, отвечает 404 на чужую цель
- [x] #3 Попытка привязать счёт, который уже держит другая цель, отклоняется 409 account_already_linked; архивная цель отклоняется 409
- [x] #4 Шит привязки на экране цели перечисляет только свободные и неархивные счета, а когда свободных нет — называет причину, а не говорит «нет счетов»
- [x] #5 Отвязка доступна со строки привязанного счёта на экране цели и шлёт goalId: null
- [x] #6 bun run test, lint, typecheck проходят
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Ветка phase-4 (общая на фазу). Готово: миграция accounts.goal_id, goalId в AccountDto и UpdateAccountInput, PATCH /accounts/{id} со связыванием и освобождением, отказы: 404 чужая цель, 409 account_already_linked, 409 goal_archived. Осталось: веб (задача 14).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Связь «счёт финансирует цель», на ветке phase-4.

Миграция добавляет accounts.goal_id (nullable, FK на goals, on delete set null) — удаление цели освобождает счета, деньги никуда не делись. goalId попал в AccountDto и только в UpdateAccountInput: цель выбирают на экране цели, когда оба уже существуют, поэтому при создании счёта её называть нечем.

PATCH /accounts/{id} связывает и отвязывает, отвечает 404 на чужую цель, 409 account_already_linked на счёт, который держит другая цель, и 409 goal_archived на архивную. Шит привязки на экране цели показывает занятые счета отключёнными и называет цель, которая их держит, а когда свободных нет — говорит именно это, а не «нет счетов».

Проверено: accounts-goal-link.test.ts (4 теста), LinkAccountSheet.test.ts (3 теста, включая отправку goalId: null при отвязке), pg-goal-archive.test.ts доказывает освобождение счетов в одной транзакции и откат при сбое. bun run test, lint, typecheck, build — зелёные.
<!-- SECTION:FINAL_SUMMARY:END -->
