---
id: TASK-064
title: 'Удаление записи остатка: подтверждение перед удалением'
status: To Do
assignee: []
created_date: '2026-09-24 11:24'
labels:
  - frontend
  - ux
dependencies: []
references:
  - apps/web/src/modules/accounts/ui/RecordBalanceSheet.vue
ordinal: 62000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
В шите «Изменить запись» (`apps/web/src/modules/accounts/ui/RecordBalanceSheet.vue`, режим редактирования последней ручной записи) кнопка «Удалить запись» удаляет сразу, без вопроса. Соседние формы так не делают: удаление расхода в ExpenseSheet идёт через AlertDialog с заголовком и объяснением. Удалённую запись остатка не вернуть, а остаток счёта после этого откатывается к предыдущей записи — случайный тап меняет капитал. Замечено при передизайне в TASK-062.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Нажатие «Удалить запись» открывает диалог подтверждения; без подтверждения запрос DELETE не уходит
- [ ] #2 В диалоге сказано, что будет с остатком счёта (вернётся к предыдущей записи), тексты прогнаны через /humanize-text
- [ ] #3 Подтверждение удаляет запись и закрывает шит; ошибки API (entry_not_latest, entry_not_manual и прочие) показываются как сейчас
- [ ] #4 Тесты RecordBalanceSheet обновлены: отмена не удаляет, подтверждение удаляет
<!-- AC:END -->
