---
id: TASK-041
title: 'Переводы: согласовать поведение внешних ключей на удаление счёта'
status: To Do
assignee: []
created_date: '2026-09-19 13:25'
labels:
  - tech-debt
  - db
dependencies: []
references:
  - docs/discovery/phase-3-execution-ledger.md
  - docs/db/schema.dbml
type: chore
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up фазы 3. Внешние ключи transfers.from_account_id и transfers.to_account_id на public.accounts остались с фазы 2 с on delete restrict, тогда как три ключа фазы 3 переведены на no action ради починки каскада при удалении профиля. Разнобой безопасен ровно до первой миграции, которая пустит каскад через transfers, — тогда удаление профиля снова упрётся в restrict, и причину будут искать заново.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Поведение ключей transfers согласовано с ключами фазы 3, выбор зафиксирован в задаче с причиной
- [ ] #2 Удаление профиля со счетами и переводами проходит целиком
- [ ] #3 Удаление счёта, на который ссылается перевод, по-прежнему запрещено
- [ ] #4 docs/db/schema.dbml обновлён в той же миграции; тесты покрывают оба сценария удаления
<!-- AC:END -->
