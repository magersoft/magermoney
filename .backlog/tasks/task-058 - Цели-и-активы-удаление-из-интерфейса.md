---
id: TASK-058
title: 'Цели и активы: кнопка «Удалить» с подтверждением, в базе — архив'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-22 06:46'
updated_date: '2026-09-24 09:25'
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
- [x] #1 На экране цели и на экране актива есть кнопка «Удалить», заметная как кнопка, а не как подпись
- [x] #2 Нажатие спрашивает подтверждение и называет последствия: у цели — сколько счетов отвяжется, у актива — что история оценок перестанет быть видна
- [x] #3 Подтверждение шлёт PATCH с archivedAt, а не DELETE; запись остаётся в базе
- [x] #4 Удалённые цель и актив исчезают отовсюду: из списков «Накоплений», из суммы капитала, из выбора счёта под цель
- [x] #5 Удаление цели отвязывает её счета, и они остаются на месте со своими балансами
- [x] #6 После удаления человек возвращается на «Накопления», список обновляется; отказ сервера показывается тостом и ничего не исчезает
- [x] #7 Прежняя формулировка «Убрать цель в архив» уходит из интерфейса и из локалей ru и en
- [x] #8 В вебе не остаётся неиспользуемых экспортов удаления
- [x] #9 Тесты покрывают подтверждение, отмену подтверждения, исчезновение из списка и отказ сервера
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decision: the API DELETE /goals/{id} and /assets/{id} stay for a future real purge; the web's useDeleteGoal/useDeleteAsset and the client remove() methods had no caller and were removed. AC5 (accounts released, balances kept) is the server's existing single-transaction release, covered by apps/api/test/goals.test.ts ('releases the accounts it held') and test/integration/pg-goal-archive.test.ts. The test i18n fixture now uses ruPlural so plural copy is asserted as rendered. Not done: a live browser check (local app needs sign-in); verified through DOM tests instead.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Goal and asset screens end with a destructive 'Удалить цель' / 'Удалить актив' button. An AlertDialog asks first and names the consequence (the goal: how many accounts come free, pluralised; the asset: its valuation history goes out of sight). Confirming sends PATCH {archivedAt}, never DELETE, then returns to /goals (the assets tab for an asset). A refusal toasts and stays. Old 'Убрать цель в архив' copy removed from ru/en. Verified: test/GoalPage.test.ts and AssetPage.test.ts (button, confirm text, cancel sends nothing, PATCH not DELETE, redirect, server refusal); GoalsSegment/AssetsSegment tests (archived rows gone, asset out of the total); full lint/typecheck/tests green. Commit 0978443 on task-058.
<!-- SECTION:FINAL_SUMMARY:END -->
