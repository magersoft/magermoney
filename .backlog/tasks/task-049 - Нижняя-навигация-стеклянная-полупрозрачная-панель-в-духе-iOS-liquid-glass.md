---
id: TASK-049
title: 'Нижняя навигация: стеклянная полупрозрачная панель в духе iOS liquid glass'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-20 08:23'
updated_date: '2026-09-20 20:02'
labels: []
dependencies: []
ordinal: 47000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Нижняя панель навигации («Главная, Счета, План, Настройки» + «+») сейчас непрозрачная: пилюля залита сплошным bg-surface-raised (apps/web/src/shared/layout/BottomNav.vue), из-за чего она выглядит как отдельная плашка поверх экрана и контент под ней просто обрезается. В iOS такие панели сделаны из полупрозрачного материала: контент просвечивает и размывается под панелью, и она читается как слой над экраном, а не как отсечённый низ.

Нужно перевести пилюлю на стеклянный материал: полупрозрачный фон + размытие и подсыщение подложки, тонкая светлая кромка и мягкая тень. Материал описать токенами в packages/ui (а не хардкодом в компоненте), чтобы им потом можно было накрыть и шапку.

Тонкие места: читаемость подписей и иконок над любым контентом (светлая и тёмная тема, яркие карточки счетов под панелью); поведение там, где backdrop-filter недоступен или выключен (Reduce Transparency / prefers-reduced-transparency) — там нужна непрозрачная подложка; «+» остаётся сплошным диском и не становится стеклянным.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Пилюля нижней навигации полупрозрачная: контент под ней просвечивает и размывается, панель читается как слой над экраном
- [ ] #2 Материал задан токенами в packages/ui и переиспользуем, в BottomNav.vue нет хардкода цветов и значений размытия
- [ ] #3 Подписи и иконки табов сохраняют контраст по WCAG AA над светлым и тёмным контентом, включая яркие карточки под панелью
- [ ] #4 Там, где backdrop-filter недоступен или пользователь просит меньше прозрачности, панель получает непрозрачную подложку и остаётся читаемой
- [ ] #5 Кнопка «+» остаётся сплошной и визуально отделена от стеклянной пилюли
- [ ] #6 Тесты покрывают выбор материала: стекло по умолчанию и непрозрачный фолбэк
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Derive the material from contrast, not taste: composite the glass fill over the app's worst-case backdrops (the darkest and lightest account-card fills across the whole hue wheel, the white card, the dark canvas) and pick the alpha at which the ink token still clears 4.5:1 — measured minimum 0.50 light / 0.65 dark, so ship 0.62 / 0.72 with headroom. muted/accent cannot survive glass (they need ~0.97), so the tab labels move to ink and the active tab is marked by an opaque capsule instead of a tint.
2. Add the material as tokens in packages/ui/src/styles/tokens.css: --mm-*-glass-fill, --mm-*-glass-opaque, --mm-*-glass-edge, --mm-*-glass-shadow, plus --mm-glass-blur / --mm-glass-saturate; theme-flipped alongside every other --mm-* token.
3. Add a glass-panel utility in packages/ui/src/styles/index.css: translucent fill + backdrop blur/saturate + hairline edge + soft shadow, with the opaque fallback nested inside the same rule under @supports not (backdrop-filter) and @media (prefers-reduced-transparency: reduce). The disabled filter is written as a neutral value (blur(0px) saturate(100%)), never the 'none' keyword, so it cannot wipe a composed property.
4. BottomNav.vue: the pill takes glass-panel and carries no colour or blur literals; inactive tabs take text-ink; the current tab takes an opaque surface-raised capsule with accent text; the '+' keeps its solid disc and never takes the glass utility.
5. Tests first. packages/ui: a composited contrast proof that reads the glass alpha out of tokens.css and checks ink through it against both backdrop extremes (red on the pre-change muted token), plus a stylesheet test that both fallback branches exist and switch the fill to the opaque token. apps/web: the pill carries glass-panel, the '+' does not, and the current tab carries the capsule.
6. Run bun run test / typecheck / lint / build, then audit the result with /impeccable.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Материал выведен из контраста, а не выбран на глаз. `packages/ui/test/glass-panel.test.ts` композитит заливку панели поверх двух крайних подложек, которые приложение реально может провести под баром — самой тёмной и самой светлой заливки карточки счёта по всему кругу оттенков, плюс белая карточка и тёмный холст. Порог: ink проходит AA от alpha 0.50 (светлая) и 0.65 (тёмная); muted и accent требуют ~0.97, то есть непрозрачной панели. Отсюда всё остальное: ship 0.62 / 0.72 с запасом, подписи табов переходят на ink, а активный таб помечается непрозрачной капсулой, на которой accent измеряется против поверхности, уже доказанной палитрой. Обратная половина вывода тоже в тестах — проверяется, что тихие роли AA НЕ проходят, иначе доказательство молча превратится в украшение.

Аудит нашёл регрессию, которую внесло само стекло: фокусное кольцо `outline-ring` (accent) над стеклом поверх насыщенной карточки читается 2.0:1 (светлая) / 1.9:1 (тёмная) — ниже 3:1 по WCAG 1.4.11. Раньше оно лежало на непрозрачной пилюле и проходило. Кольцо переведено на `currentColor` внутрь (inset): цвет собственной метки контрола — это по построению единственный цвет, уже доказанный против поверхности, на которой контрол стоит (ink на стекле, accent на капсуле, собственный foreground диска на диске).

Сборка вскрыла вторую ловушку: lightningcss переписывает `backdrop-filter: blur(0px) saturate(100%)` в `blur() saturate()`. Тест по исходнику этого не видит. Нейтральное значение перенесено в сами токены (`--mm-glass-blur: 0px`), которые минификатор обязан отдать дословно; скомпилированный CSS проверен глазами — обе ветки фолбэка на месте.

Визуальная проверка: разметка пилюли отрисована в браузере на реальном скомпилированном CSS поверх настоящих заливок карточек, на ширине телефона, в обеих темах и в непрозрачном фолбэке. Единственная правка после неё — `shadow-card` на капсуле: над бледной карточкой белая капсула и светлое стекло почти одного тона, и подъём — это то, что их разделяет; в тёмной теме токен не рисует ничего, потому что там капсула и так светлее стекла.
<!-- SECTION:NOTES:END -->
