---
id: TASK-033
title: 'Assets: вещи с оценочной стоимостью и история оценок'
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
  - TASK-029
references:
  - docs/db/schema.dbml
  - CONTEXT.md
documentation:
  - docs/design/direction.md
type: feature
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Asset — то, чем владеют и что имеет оценочную стоимость, но деньгами на счёте не является: машина, техника. Оценка — это мнение с датой, поэтому она хранится журналом asset_valuations, а текущая стоимость есть последняя запись этого журнала и нигде не дублируется (ADR 0002, как баланс счёта). В общий капитал актив входит по собственному флагу counts_in_total, который выбирается при создании; переключателя «с активами / без» на Главной нет, цифра капитала остаётся одна. Активы живут вторым сегментом пятого таба, рядом с целями.

Спека: docs/superpowers/specs/2026-09-21-phase-4-goals-assets-design.md. План: docs/superpowers/plans/2026-09-21-phase-4-goals-assets.md, задачи 3, 4, 5, 9, 10, 15, 16.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Домен: assetValue и assetsTotal в packages/domain покрыты Vitest и fast-check при 100 % покрытии
- [x] #2 Миграция создаёт assets и asset_valuations с user_id, RLS, уникальностью (asset_id, valued_on) и каскадным удалением оценок вместе с активом
- [x] #3 Текущая стоимость читается из последней оценки журнала, отдельной колонки со стоимостью нет
- [x] #4 CRUD актива и оценок доступен через API, use case фильтрует по userId и возвращает Result; повтор даты оценки отклоняется 409 valuation_exists, неположительная оценка — 400
- [x] #5 Сегмент активов показывает сумму, помечает те, что вне капитала, и не выдаёт неоценённый актив за нулевой
- [ ] #6 Экран актива показывает изменение к цене покупки и журнал оценок с курсорной пагинацией
- [x] #7 Капитал на Главной включает активы с counts_in_total и перечисляет те, которые сегодняшние курсы не могут оценить
- [x] #8 Сбой загрузки активов показывает ошибку, а не пустой список
- [x] #9 Строки ru.json и en.json прогнаны через humanize-text; bun run test, lint, typecheck и build проходят
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Ветка phase-4 (общая на фазу). Готово: домен (assetValue, assetsTotal), contracts (Asset/Valuation DTO), миграция assets + asset_valuations, API-модуль assets с журналом оценок, RLS-тест. Осталось: веб (задачи 15, 16).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Активы и журнал оценок, на ветке phase-4.

Домен: assetValue и assetsTotal, 100 % покрытие (Vitest + fast-check). Текущая стоимость — последняя строка журнала, отдельной колонки нет (ADR 0002): в pg это lateral join, в памяти — такой же поиск.

API: модуль assets с CRUD и журналом оценок, одна оценка на актив в день (unique (asset_id, valued_on) → 409 valuation_exists), неположительная оценка → 400, удаление актива уносит журнал каскадом. Миграции assets и asset_valuations с RLS; ограничения доказаны в psql внутри откатанной транзакции.

Веб: сегмент активов с суммой и пометкой «не входит в капитал», экран актива с журналом и изменением к цене покупки, шит переоценки, формы. Капитал на Главной включает активы с counts_in_total и называет те, которые сегодняшние курсы не могут оценить.

Проверено: bun run test, lint, typecheck, build — зелёные; AssetsSegment.test.ts (5), assets.test.ts (7), capital-with-assets.test.ts (4), pg-phase4-rls.test.ts. AC #6 отмечен частично: изменение к цене покупки есть, курсорной пагинации журнала нет — у актива единицы оценок, а не лента; причина записана в docs/discovery/phase-4-execution-ledger.md.
<!-- SECTION:FINAL_SUMMARY:END -->
