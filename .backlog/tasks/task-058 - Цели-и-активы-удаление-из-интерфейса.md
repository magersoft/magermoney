---
id: TASK-058
title: 'Цели и активы: кнопка «Удалить» с подтверждением, в базе — архив'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-22 06:46'
updated_date: '2026-09-24 09:10'
labels:
  - web
  - ux
dependencies: []
ordinal: 56000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
У целей и активов нет способа убрать их из приложения. На экране цели есть только «Убрать цель в архив» — серый ghost-текст в самом низу, за сгибом, — и он работает как исчезновение без обратного хода: GoalsSegment фильтрует список по archivedAt, а места, где архив можно увидеть или вернуть цель, не существует. У актива нет и этого: AssetsSegment фильтрует по флагу, который никто не выставляет. Удалить можно только отдельную оценку из журнала.

Решение владельца: человеку показываем одну операцию — «Удалить», обязательно с подтверждением. В базе это не удаление, а архив: запись остаётся с проставленным archivedAt, потому что на неё завязана история и отменить настоящее удаление нечем. Архив становится деталью реализации, а не разделом интерфейса: отдельного экрана архива и возврата из него не делаем — то, что человек удалил, исчезает отовсюду. Счета живут иначе, у них архив и возврат видимые, и это сознательное расхождение: счёт переживает свои операции, цель нет.

Делается это обычным PATCH: archivedAt есть и в UpdateGoalInput, и в UpdateAssetInput. На сервере архивирование цели уже отвязывает её счета в той же транзакции (goals/application/goals.ts). Существующие DELETE /goals/{id} и DELETE /assets/{id} после этого остаются без единого вызова, как и написанные useDeleteGoal и useDeleteAsset — решить, убрать их или оставить настоящую зачистку на потом, и не оставлять в вебе мёртвых экспортов.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 На экране цели и на экране актива есть кнопка «Удалить», заметная как кнопка, а не как подпись
- [ ] #2 Нажатие спрашивает подтверждение и называет последствия: у цели — сколько счетов отвяжется, у актива — что история оценок перестанет быть видна
- [ ] #3 Подтверждение шлёт PATCH с archivedAt, а не DELETE; запись остаётся в базе
- [ ] #4 Удалённые цель и актив исчезают отовсюду: из списков «Накоплений», из суммы капитала, из выбора счёта под цель
- [ ] #5 Удаление цели отвязывает её счета, и они остаются на месте со своими балансами
- [ ] #6 После удаления человек возвращается на «Накопления», список обновляется; отказ сервера показывается тостом и ничего не исчезает
- [ ] #7 Прежняя формулировка «Убрать цель в архив» уходит из интерфейса и из локалей ru и en
- [ ] #8 В вебе не остаётся неиспользуемых экспортов удаления
- [ ] #9 Тесты покрывают подтверждение, отмену подтверждения, исчезновение из списка и отказ сервера
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Tests first (GoalPage.test.ts, AssetPage.test.ts): button is a real destructive button; click opens AlertDialog naming consequences (goal: N linked accounts released; asset: valuation history hidden); cancel sends nothing; confirm sends PATCH {archivedAt}, never DELETE, returns to /goals (assets tab for an asset); server refusal shows a toast and stays; archived goal/asset gone from list.
2. Web: useArchiveGoal -> useRemoveGoal? No: keep archive as the write, name the UI op 'delete'. Add useArchiveAsset beside useUpdateAsset. Remove useDeleteGoal/useDeleteAsset and goalsApi.remove/assetsApi.remove from the web (API DELETE routes stay as a future true purge, unused by the client).
3. GoalPage: replace ghost 'Убрать цель в архив' with outline destructive 'Удалить цель' + AlertDialog. AssetPage: same, 'Удалить актив'.
4. Locales ru/en: drop goals.archive/archived/archiveHint; add delete/deleteTitle/deleteBody (plural by linked accounts)/cancel/deleted for goals and assets. Humanize copy.
5. Test fixture i18n gets ruPlural so plural copy is asserted as the app renders it.
6. Lint, typecheck, full web tests; impeccable pass on the two screens.
<!-- SECTION:PLAN:END -->
