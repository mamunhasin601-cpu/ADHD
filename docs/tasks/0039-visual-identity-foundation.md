# Task 0039 — Visual Identity Foundation

## Статус

В работе. Phase A завершена, Phase B.1 объединена, а source-level реализация
Phase B.2 проходит проверку в draft PR. Task 0039 и полная Phase B ещё не
завершены; physical-device и assistive-technology approval остаются
неподтверждёнными. Production Orbits raster assets, theme tokens и navigation
foundation уже существуют; paid packs, entitlement и billing не реализованы.

## Контекст

Focus уже описан как спокойный взрослый напарник, который помогает начать,
вернуться и перестроить день без стыда. В Product Bible есть отдельные места
для тем, accessibility и монетизации, но нет единого visual identity contract.
Без него экраны могут получить случайную палитру, перегрузку акцентами или
платную персонализацию, которая выглядит как функциональный paywall.

## Цель

Создать согласованный фундамент визуальной идентичности и персонализации,
сохранив ясность действия, adult tone и право пользователя вернуться в любой
день. Направление: **Focus is calm but alive** — тёплый светлый фон, спокойные
поверхности, умеренная выразительность и заметное, но не шумное движение.

## Принятое направление

- Базовый фон — тёплый светлый, а не холодный чисто-белый. Финальные hex/tokens
  определяются только на этапе реализации и accessibility-проверки.
- Семантическая палитра: purple — бренд, навигация и primary actions; turquoise —
  спокойный прогресс и завершение; coral — важность и срочность без моральной
  оценки; yellow — награды, streaks и маленькие победы. Цвет никогда не является
  единственным сигналом.
- Первый reference screen — **Today**: короткое приветствие и дата, процент
  выполнения, progress ring, читаемый timeline карточек задач, понятный quick-add,
  спокойные empty states и ясная нижняя навигация. Today служит проверочным
  экраном, а не разрешением раскатать стиль на весь продукт.
- Бесплатный/default pack — **Orbits**. Будущие платные альтернативы —
  **Focus Sparks** (мягкая четырёхлучевая искра и орбитальная точка) и
  **Focusiki** (эмоциональный персонажный pack). Они меняют визуальный слой,
  но не скрывают задачи, recovery или базовые действия.
- Иконки и emoji должны оставаться читаемыми, локализуемыми и знакомыми. Нельзя
  обещать лицензированные provider marks или использовать их как реализованный
  runtime-факт. Долгосрочное направление auth — заменить placeholder letters
  (`Я`, `ВК`, `@`) чистыми rounded marks с сохранением provider identity и brand
  rules; эти marks не входят в replaceable packs.
- Focus character — опциональный помощник: не блокирует, не наблюдает постоянно,
  не наказывает, не стыдит и не делает продукт детским. Базовая поддержка
  остаётся бесплатной.

## План работ

### Phase A — Documentation and visual spec (обязательно первой)

1. Определить точную palette/semantic tokens и tokens для spacing, sizing,
   radii, restrained shadows и typography.
2. Определить icon/emoji language, accessibility и visual-noise constraints;
   спроектировать полный бесплатный Orbits set.
3. Подготовить текстовый wireframe и visual mockup Today: header/progress ring,
   timeline card, quick-add, empty state, bottom navigation и completed state.
4. Проверить mockup на небольшом экране, системном масштабировании, screen
   reader labels, контрасте, reduced motion и отключённых haptics.
5. Получить product/design approval. До approval implementation не начинается.

### Phase B — First implementation (после approval)

1. Реализовать shared tokens, базовый Orbits pack и unified buttons/cards/badges/
   fields через архитектуру, допускающую будущие Sparks/Focusiki.
2. Реализовать только Today как первый reference implementation и проверить
   переходы, completion, recovery/undo, loading/error/empty states.
3. Добавить accessibility и sensory regression evidence: contrast, text scaling,
   touch targets, non-color cues, reduced motion, sound/haptic opt-out.
4. Добавить focused behavioral tests, runtime evidence и честный список gaps.
5. Не раскатывать стиль на остальные экраны без отдельного evidence gate.

### Phase C — Future personalization and monetization (отдельно)

1. Спроектировать pack architecture, preview/reset и безопасный fallback на Orbits
   при недоступном entitlement или asset.
2. Исследовать Focus Sparks и Focusiki как coherent visual packs; не смешивать
   их с Phase B без отдельного approval.
3. Решение о коммерческой модели (one-time purchase, subscription или часть
   более широкого premium tier) остаётся открытым и требует отдельного решения.
4. Не добавлять pricing, store, billing или entitlement runtime в эту задачу.

## Acceptance / evidence gates

- Product Bible содержит один источник visual identity policy и ссылки из UX,
  ADHD, Today screen map, monetization и roadmap.
- Approved direction явно отделена от planned/not implemented и от runtime facts.
- Today mockup и implementation проходят accessibility/sensory review; animation,
  sound и haptics не обязательны для смысла.
- Free/default Orbits сохраняет полный базовый путь «увидеть → начать →
  вернуться». Pack unavailable/expired не повреждает задачи и данные.
- Помимо утверждённых Orbits raster assets из Phase B.1 не добавляются
  непроверенные production assets, лицензированные логотипы, цены или paywall
  flow; database/schema/migration и production deployment не затрагиваются.

## Phase A checkpoint — 2026-08-27

- Concept board архивирован в `docs/design/visual-references/orbits/` как
  visual-language inspiration; четыре supplied PNG сохранены без изменений.
- `orbits-navigation-approved-direction-02.png` утверждён как navigation
  direction; `orbits-navigation-approved-direction-01.png` сохранён как
  superseded design history.
- `today/today-orbits-approved-direction-01.png` утверждён как Today visual
  direction.
- Добавлены reference index и implementation-neutral спецификация:
  `docs/design/visual-references/orbits/README.md` и
  `docs/design/orbits-visual-spec.md`.
- Production SVG, app code, shared runtime tokens, provider marks и
  accessibility runtime evidence не добавлялись.
- Exact semantic colors, contrast pairs, typography/spacing values, SVG/icon
  sources и runtime/device checks остаются открытыми для Phase B evidence gate.
- Phase B не начата; статус задачи остаётся «Запланировано».

## Phase A.2 checkpoint — 2026-08-27

- Созданы пять SVG navigation prototypes Orbits: Today, Plan, Add, internal
  Progress (`Успех` в permanent visible contract) и Profile; добавлены
  active/inactive preview и inspection на 24/28/32 px.
- `Добавить` остаётся отдельным raised action, а не selected destination.
- В preview labels остаются реальным UI text; SVG используют `currentColor` и
  candidate accents, без production integration.
- Application code, `apps/mobile/assets` и runtime navigation не изменялись.
- Production asset approval не заявляется; visual approval пользователем для
  финальной vector geometry остаётся обязательным.
- Contrast, screen-reader/text-scaling/device evidence и другие accessibility
  проверки остаются открытыми; Phase B не начата, статус задачи не изменён.

## Phase A.3 checkpoint — 2026-08-27

- Phase A.2 SVG direction отклонено после visual review из-за слабых scale и
  visual presence, а также black fallback при external-`<img>` `currentColor`;
  пять SVG сохранены как superseded historical artifacts и не являются
  production assets.
- Пять approved transparent raster masters зафиксированы для Today, Plan, Add,
  internal Progress (`Успех` в permanent visible contract) и Profile без redraw,
  recoloring или изменения исходных bytes.
- Из masters детерминированно подготовлены 1×/2×/3× candidates: normal icons
  44/88/132 px и raised Add 64/128/192 px; labels остаются реальным UI text.
- Static preview показывает warm light `#FCF9F6`, gray candidate `#8B8E96` и
  dark candidate `#211D2E`, active/non-color cues и Add default/pressed/disabled.
- Source-level responsive review покрывает 320, 360, 390, 412 и 480 logical px,
  а также increased-text example: слова не скрываются, порядок не меняется,
  touch-target intent остаётся не меньше примерно 44×44.
- Accessibility review проверяет visible labels, non-color active container,
  decorative icon semantics, отсутствие animation/flash и documented contrast
  boundary. Physical-device, screen-reader, final gray/dark token и platform
  rendering evidence всё ещё обязательны.
- Application code, `apps/mobile/assets`, production integration, theme/pack
  switching и entitlement runtime не изменялись. Интеграция отложена до Phase B;
  Task 0039 остаётся «Запланировано».

### Phase A.3 visual correction — 2026-08-28

- Постоянное user-facing имя четвёртой navigation section — `Успех`; полный
  contract: `Сегодня | План | Добавить | Успех | Профиль`.
- Internal technical identifier `progress`, route и filenames
  `orbits-progress*` сохраняются без rename. Mobile application ещё не
  интегрировало новое visible label; это остаётся работой Phase B.
- Full navigation surface следует `theme.background`, без hardcoded white card:
  warm `#FCF9F6`, gray candidate `#8B8E96`, dark candidate `#211D2E`.
- На dark preview все пять navigation labels white. Compact active state
  дополнительно использует background, border, shape и label weight, поэтому
  selection не зависит только от цвета.
- Exact gray/dark runtime tokens, physical-device contrast и accessibility
  evidence остаются pending; PNG masters и density exports не изменялись.

## Phase B.1 checkpoint — 2026-08-29

- Production now contains the 15 approved Orbits navigation density exports,
  typed static asset roots, semantic warm/gray/dark tokens and a reusable
  accessible presentational navigation component.
- The app still uses the current four-route navigation (`today`, `inbox`,
  `focus`, `settings`). The Orbits bar is not installed because План and Успех
  do not yet have truthful route mappings; GlobalCapture remains unchanged.
- No theme-selection UI or persistence exists. Gray and dark are candidates;
  Android/iOS physical-device rendering, text scaling, screen reader behavior
  and final gray/dark approval remain unverified.
- The source-level Today reference screen now exists in Phase B.2. Physical-device
  and assistive-technology approval remain pending. Paid packs, entitlement and
  billing remain deferred. This checkpoint does not complete Phase B or Task 0039.
- Detailed evidence and boundaries are recorded in
  [`0039b1-orbits-theme-navigation-foundation.md`](0039b1-orbits-theme-navigation-foundation.md).

## Honesty boundary

Эта задача не означает, что:

- source-level Orbits Today reference screen прошёл physical-device rendering,
  large-text, VoiceOver/TalkBack или финальную runtime accessibility-проверку;
- финальные production SVG assets одобрены;
- character system завершён;
- paid packs реализованы;
- billing подключён;
- pricing определён;
- commercial model определена;
- provider marks лицензированы, одобрены или реализованы;
- accessibility runtime-verified;
- motion и haptics проверены на physical Android device;
- каждый экран приложения использует новую систему.

Concept images и mockups остаются design references, а не production assets.

## Связанные документы

- [Product Bible](../../Product-Bible/Product-Bible.md)
- [UX Principles](../../Product-Bible/03-UX/UX-Principles.md)
- [ADHD Principles](../../Product-Bible/04-ADHD/ADHD-Principles.md)
- [Future Screen Map](../../Product-Bible/05-Experience/Future-Screen-Map.md)
- [Monetization Philosophy](../../Product-Bible/08-Monetization/Monetization-Philosophy.md)
- [Feature Roadmap](../../Product-Bible/09-Roadmap/Feature-Roadmap.md)
- [Theme System](../../Product-Bible/10-Theme-System/Theme-System.md)

### Phase B status update — Today reference screen

Phase A is complete and Phase B.1 is merged. Phase B.2 now integrates the Orbits Today reference screen at source level (see `0039b2-orbits-today-reference-screen.md`); Task 0039 and full Phase B remain in progress. This does not install five-item navigation, theme selection/persistence, or establish physical-device/accessibility approval.
