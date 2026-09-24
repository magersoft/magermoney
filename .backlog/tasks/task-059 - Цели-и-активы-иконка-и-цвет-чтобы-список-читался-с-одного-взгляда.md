---
id: TASK-059
title: 'Цели и активы: иконка и цвет, чтобы список читался с одного взгляда'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-22 06:46'
updated_date: '2026-09-24 09:15'
labels:
  - web
  - design
  - ux
dependencies: []
ordinal: 57000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Список целей и список активов сейчас одинаково серые: карточка цели и строка актива отличаются только текстом названия, так что найти «Машину» среди восьми строк можно только прочитав все восемь. У счетов эта задача уже решена — у них есть colorway и вид банковской карты (TASK-046, TASK-055), — а накопления остались без визуального языка.

Половина данных для этого уже есть и не используется: goals.icon лежит в контракте и печатается в GoalCard, но выбрать иконку в форме цели негде, так что поле всегда пустое. У активов нет ни иконки, ни цвета вовсе. Решить надо обе стороны сразу: чем помечаем (набор иконок против произвольного эмодзи) и чем красим (палитра счетов против своей), потому что цель и актив стоят на одном экране рядом и не должны выглядеть как два разных приложения.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 У цели и у актива есть иконка и цвет, которые выбираются в их формах и хранятся вместе с записью
- [ ] #2 Иконка и цвет видны в карточке цели, в строке актива и на их отдельных экранах
- [ ] #3 Цвет берётся из ограниченной палитры, а не вводится вручную, и проходит контраст на светлой и тёмной теме
- [ ] #4 У записи без выбранного цвета и иконки есть внятный вид по умолчанию, а не пустое место
- [ ] #5 Визуальный язык целей и активов согласован между собой и со счетами; расхождения названы в описании решения
- [ ] #6 Контракты, миграция и API несут новые поля; старые записи читаются без них
- [ ] #7 Тесты покрывают выбор в форме, отображение в списке и запись без иконки и цвета
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Decision: a goal and an asset are marked the way the profile disc is: one emoji from a curated grid (any single emoji accepted by the API, same rule as avatars) and a colour from the account card palette (8 named colorways, each already contrast-proven for its own ink in both themes). Drawn as a disc beside the name. Unmarked: the first letter of the name on the neutral surface, so no row is blank.
Divergences from accounts, to state in the final summary: accounts paint the whole card and fall back to the currency's hue; goals/assets paint only a disc and fall back to neutral, because a goal/asset has no card and no single currency identity worth colouring, and the colour should mean 'the person chose this'.
1. domain: MARK_COLORS (= ACCOUNT_COLORWAYS), isMarkEmoji (= avatar rule). Test.
2. contracts: MarkEmojiSchema/MarkColorSchema; Goal gets color, its icon input tightened to one emoji; Asset gets icon + color. DTO icon stays lenient string so any old row still reads.
3. migration 024: goals.color, assets.icon, assets.color with checks mirroring profiles.avatar_*; goals.icon length check NOT VALID. migration-reviewer agent.
4. API: rows, pg + memory repos, use cases; tests for create/patch/clear and old rows without marks; pg integration if the local DB is up.
5. packages/ui: MarkDisc (glyph-or-initial on a card-palette fill) and MarkPicker (emoji radiogroup + colour radiogroup + live preview), labels from props. Tests incl. keyboard.
6. web: shared emoji list; Goal/Asset mappers; GoalFormPage/AssetFormPage get the picker; GoalCard header and AssetRow show the disc. Tests: pick in form -> body carries icon/color; list shows disc; record without marks shows initial.
7. i18n ru/en (humanize), frontend-design before markup, impeccable pass + browser check of both screens (also covers TASK-058's buttons).
<!-- SECTION:PLAN:END -->
