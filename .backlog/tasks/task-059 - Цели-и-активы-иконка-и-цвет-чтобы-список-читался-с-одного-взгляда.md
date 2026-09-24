---
id: TASK-059
title: 'Цели и активы: иконка и цвет, чтобы список читался с одного взгляда'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-22 06:46'
updated_date: '2026-09-24 09:25'
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
- [x] #1 У цели и у актива есть иконка и цвет, которые выбираются в их формах и хранятся вместе с записью
- [x] #2 Иконка и цвет видны в карточке цели, в строке актива и на их отдельных экранах
- [x] #3 Цвет берётся из ограниченной палитры, а не вводится вручную, и проходит контраст на светлой и тёмной теме
- [x] #4 У записи без выбранного цвета и иконки есть внятный вид по умолчанию, а не пустое место
- [x] #5 Визуальный язык целей и активов согласован между собой и со счетами; расхождения названы в описании решения
- [x] #6 Контракты, миграция и API несут новые поля; старые записи читаются без них
- [x] #7 Тесты покрывают выбор в форме, отображение в списке и запись без иконки и цвета
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Validation: domain test/mark.test.ts; contracts phase4 (schemas, lenient DTO defaults); API goals/assets tests (create, patch, clear, refusals); pg integration test/integration/pg-marks.test.ts against local Supabase (migration applied by psql, because the local migration history is out of sync: supabase migration up tries to re-run 20260921000020); ui test/mark.test.ts (disc, radiogroups, keyboard, focus); web mark-forms, marks-mappers, GoalsSegment/AssetsSegment. migration-reviewer: no blocking findings; optional follow-up is a later VALIDATE CONSTRAINT goals_icon_check once prod has no long icons. Contrast: fills and inks are the card palette, already proven in packages/ui/test/tokens-contrast.test.ts; the disc adds no overlay. Not done: a live browser check (sign-in required).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Goals and assets carry a mark: one emoji (curated 24-emoji grid; the API accepts any single emoji, the avatar's rule) and one of the 8 card-palette colours. It is drawn as a disc (MarkDisc in packages/ui) leading the goal card and the asset row, so it shows on the lists and on both detail screens. Unmarked means the name's first letter on the sunken surface. In both forms the disc beside the name is the button: it opens a sheet with MarkPicker (two radio groups, arrow keys, roving tab stop); the choice saves with the form. Migration 024 adds goals.color, assets.icon and assets.color (checks mirror profiles.avatar_*; goals.icon bound NOT VALID for legacy rows); DTOs default to null so older responses parse; a legacy non-emoji goal icon reads as none. Divergences from accounts: accounts paint the whole card and fall back to the currency's hue. Goals and assets paint only a disc and fall back to neutral, because they have no card, and colour on them should mean the person chose it. Verified by domain, contract, API, pg integration, ui and web tests; full lint/typecheck/test/build green. Commits ccf4601, 1dee6cb on task-059 (stacked on task-058).
<!-- SECTION:FINAL_SUMMARY:END -->
