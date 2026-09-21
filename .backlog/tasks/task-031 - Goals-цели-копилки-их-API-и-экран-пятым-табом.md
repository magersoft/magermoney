---
id: TASK-031
title: 'Goals: цели-копилки, их API и экран пятым табом'
status: In Progress
assignee:
  - '@magersoft'
created_date: '2026-09-19 13:23'
updated_date: '2026-09-21 12:42'
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
  - docs/discovery/decisions-log.md
documentation:
  - docs/design/direction.md
type: feature
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Цель — то, на что копят: целевая сумма в своей валюте, необязательный срок и счета, которые её финансируют. Накопленное = сумма балансов привязанных счетов, приведённая к валюте цели по сегодняшним курсам, и API его не отдаёт: считает клиент (ADR 0003). Экран отвечает на вопрос «когда я её достигну при текущем темпе» — темп измеряется по журналу balance_entries привязанных счетов за последние 6 месяцев; при истории меньше двух месяцев или непозитивном темпе прогноза нет, и экран говорит об этом прямо. Жизнь цели: active → achieved → archived; achieved_at ставит сервер один раз и сам не снимает при падении курса, архивация — решение владельца, и она отвязывает счета в той же транзакции. Пятый таб называется «Цели» и несёт два сегмента: Цели и Активы (TASK-033).

Спека: docs/superpowers/specs/2026-09-21-phase-4-goals-assets-design.md. План: docs/superpowers/plans/2026-09-21-phase-4-goals-assets.md, задачи 1, 2, 4, 5, 6, 7, 10, 11, 12, 13.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Домен: goalProgress и goalForecast в packages/domain покрыты Vitest и fast-check при 100 % покрытии; прогноз отсутствует при истории меньше двух месяцев и при непозитивном темпе
- [ ] #2 Миграция создаёт goals с user_id, RLS и check target_amount > 0; schema.dbml обновлён, monthly_share и income_source_id из наброска убраны
- [ ] #3 CRUD цели доступен через API, каждый use case фильтрует по userId и возвращает Result; накопленное в DTO не отдаётся
- [ ] #4 Архивация цели проставляет отметку и обнуляет goal_id у привязанных счетов в одной транзакции deps.uow; это доказано pg-интеграционным тестом
- [ ] #5 achieved_at проставляется один раз и не снимается, когда накопленное падает обратно; покрыто тестом use case
- [ ] #6 Пятый таб «Цели» есть в обеих навигациях, пилюля проверена на ширине 320 px, доказательство контраста стекла перепрогнано под пять табов
- [ ] #7 Сегмент целей показывает накопленное, остаток и строку прогноза; при отсутствии прогноза строка объясняет причину, а не пустует
- [ ] #8 Сбой загрузки целей показывает ошибку, а не пустой список
- [ ] #9 Строки ru.json и en.json прогнаны через humanize-text; bun run test, lint, typecheck и build проходят
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
План исполнения — docs/superpowers/plans/2026-09-21-phase-4-goals-assets.md, задачи 1, 2, 4, 5, 6, 7, 10, 11, 12, 13.
1. Задача 1 — домен: goalProgress + тесты и property-тесты
2. Задача 2 — домен: goalForecast (окно 6 мес., минимум 2 мес. истории)
3. Задача 4 — contracts: zod DTO Goal (совместно с TASK-032/033)
4. Задача 5 — миграции goals и schema.dbml (совместно)
5. Задача 6 — API: модуль goals, CRUD, achieved_at один раз
6. Задача 7 — API: архивация отвязывает счета в одной deps.uow
7. Задача 10 — pg-интеграционные тесты фазы 4 (совместно)
8. Задача 11 — веб: пятый таб и модуль savings, маршруты
9. Задача 12 — веб: data-слой goals и offline-вход
10. Задача 13 — веб: сегмент Целей, экран цели, форма
Ветка одна на всю фазу — phase-4 (решение владельца, 2026-09-21).
<!-- SECTION:PLAN:END -->
