# Task 0039 — Visual Identity Foundation

## Статус

**Accepted — 2026-09-28.** Production-код и автоматические проверки завершены;
обязательный Realme visual/timeline/accessibility smoke пройден. Task 0039
принята в пределах утверждённой Visual Identity Phase B и последующих Timeline
corrective packages. Отдельный push-delivery smoke не пройден: он заблокирован
отсутствием рабочего EAS `projectId`, credentials и device push token. Phase C,
paid packs, entitlement, billing и следующий пакет `Сейчас по плану /
конкурентная модель` не входят в этот close-out и не реализованы.

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
2. Начать с Today как reference implementation, затем после отдельных evidence
   gates распространить tokens на установленную навигацию, основные, вложенные
   и pre-auth маршруты, формы, панели и системные transition canvases.
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
- platform-controlled Android navigation bar прошёл отдельную runtime-проверку.

Concept images и mockups остаются design references, а не production assets.

## Связанные документы

- [Product Bible](../../Product-Bible/Product-Bible.md)
- [UX Principles](../../Product-Bible/03-UX/UX-Principles.md)
- [ADHD Principles](../../Product-Bible/04-ADHD/ADHD-Principles.md)
- [Future Screen Map](../../Product-Bible/05-Experience/Future-Screen-Map.md)
- [Monetization Philosophy](../../Product-Bible/08-Monetization/Monetization-Philosophy.md)
- [Feature Roadmap](../../Product-Bible/09-Roadmap/Feature-Roadmap.md)
- [Theme System](../../Product-Bible/10-Theme-System/Theme-System.md)

### Historical Phase B status update — Today reference screen

At the B.4 checkpoint, Phase A and Phase B.1–B.4 were merged, Today was the
reference screen, warm/gray/dark were selectable, and five-item navigation was
not yet installed. This paragraph records that historical checkpoint; the
current policy and implementation are stated below.

## Phase B.3 note (2026-08-30)

Device-local selection of the free Orbits `warm`, `gray`, and `dark` backgrounds is implemented with warm as fail-safe. It is independent of authentication, billing and API state and survives logout. Focus Sparks and Focusiki remain future paid alternative packs. Task 0039 and Phase B remain in progress; source tests are not physical-device or assistive-technology approval.


## Phase B.4 note (2026-09-01)

Pixel 7 Android 15/API 35 emulator verification confirmed warm/gray/dark
selection, Metro reload behavior and persistence of the gray preference after
the app process was removed and relaunched. Runtime review found a decorative
`○` that looked like a stuck spinner and a harsh gray canvas/surface split.
The Today empty state no longer renders that glyph, and the gray runtime canvas
is now `#E7E7EA`; focused Jest, TypeScript, Metro Android bundling and diff
checks passed. The gray correction has post-fix emulator screenshot evidence.
The empty-state correction is covered by focused rendering tests but lacks a
post-fix empty-state emulator screenshot because the test account exposes a
recurring task on the inspected dates.

This evidence is emulator-only. It does not approve physical Android/iOS,
TalkBack, VoiceOver, large text, reduced motion, haptics or physical timeline
touch targets. Details: [`0039b4-orbits-android-runtime-verification.md`](0039b4-orbits-android-runtime-verification.md).

## Phase B closure checkpoint — 2026-09-26

The production/code package now includes the installed five-destination Orbits
navigation, warm/dark semantic theming across the authenticated and pre-auth
routes, themed transition/loading surfaces, task form, Quick Capture and
notification banner. Recovery lives in Plan, the Plan orbit retains its badge,
and the embedded card has no duplicate external heading.

The device-local theme remains independent from authentication and survives
logout. Quick Capture keeps its in-memory draft after swipe, Android Back and
backdrop dismissal, and clears it after explicit Cancel, successful submit or a
session/identity boundary. The product offers one `Отдых` type; old BUFFER data
continues to render and edit as Rest without a destructive migration or silent
rewrite.

Focused and regression automation is recorded in the implementation report.
This closes Phase B production/code scope, not the physical evidence gate:
pre-auth cold starts, the draft lifecycle, legacy BUFFER records, maximum text,
TalkBack/VoiceOver, touch targets and Android system navigation-bar behavior
still require device verification. Phase C remains out of scope.

## Physical acceptance defect follow-up — 2026-09-27

Production code now addresses the defects found during the Realme acceptance
pass: Today-selected date propagation through the central Add action, explicit
recurring-edit scopes, occurrence-date time editing, an elastic shared timeline
coordinate transform, readable task/Rest/Now cards, non-breaking H12 labels,
large-text-safe navigation/header/forms, reactive Android system bars, and a
keyboard-safe login layout. Thoughts intentionally remains an undated inbox.

`THIS_AND_FUTURE` splits at the selected local date and keeps historical and
started/completed occurrence UUIDs and state. Removed future projection rows have
their recovery references and reminders cleaned up.

Automated regression and Android export evidence belongs to the implementation
report for this pass. These changes are **not** physical acceptance: the Realme
warm/dark, H12, maximum-font, keyboard, system-bar, recurrence and dense-timeline
matrix must be repeated on-device. Push delivery remains blocked until the real
Expo/EAS project identity and credentials are available; no placeholder
`projectId` is permitted.

## Second physical acceptance corrective package — 2026-09-27

The repeated Realme pass found five remaining source defects: whole-series
actions stopped at the latest technical split; Now/tick/task-time labels could
occupy the same gutter bounds; started tasks did not expose elapsed plan usage;
a focused 220dp NowCard gap survived the transition to compact started state;
and the combined maximum font/display setting could compress header, week strip,
cards and Orbits beyond a usable fallback.

The corrective package adds durable logical recurrence lineage plus a forward
Prisma migration, bounds-based gutter collision priority, minute-based elapsed
fill/overtime semantics with TalkBack copy, state-specific elastic heights, and
an explicit combined-extreme accessibility fallback. Multi-split edits/deletes,
protected started/completed instances, recovery-reference cleanup, reminder
invalidation, time formats, safe-area layout and transition geometry are covered
by focused automation.

This is still **retest pending**, not final physical acceptance. Re-run the six
Realme themes listed in the handoff; the previously confirmed selected-date,
recurrence-scope, dense collision, Rest, H12, system-bar, keyboard and TalkBack
smoke results remain preserved unless the device retest disproves them. Push
delivery remains blocked by real Expo/EAS identity and credentials and was not
changed by this package.

## Final physical acceptance corrective package — 2026-09-27

The latest Realme pass reconfirmed multi-split whole-series update/delete,
minute elapsed refresh without automatic completion, persisted started/overtime
state, maximum font/display reachability, warm/dark system surfaces, and
TalkBack operation. The accepted task-fill colors and opacity remain unchanged.

The remaining defects were narrower: an H12 Now marker and its orbit could touch
the next card, explicit Start removed the visible scheduled-time context and
then lost the external current-time cue, very old valid starts exposed thousands
of raw minutes, and the approved wash lacked the requested diagonal sense of
time. Read-only data inspection confirmed the large totals come from persisted
explicit `startedAt` instants, not scheduled-start substitution or timezone
parsing. User lifecycle data and completion semantics therefore remain intact.

An explicitly started card now keeps scheduled start/duration and owns one
internal `Сейчас …` elapsed line. The external Now beacon is confined to the
gutter and is removed when current time lies in the measured started-card bounds.
Measured content height feeds the shared elastic transform, so wrapped titles
and compact hour/day overtime text move subsequent content without overlap or
stale space. Unstarted overdue items still do not infer progress.

The elapsed wash now advances by area from top-left to bottom-right behind text
and controls. Each real progress increase can run one finite 1.1-second settling
wave; hydration is immediate, ordinary rerenders do not replay it, and only the
visible active started task may animate. Background/off-screen and Reduce Motion
states use the static diagonal result. TalkBack exposes title, started state,
scheduled time, current time, and either elapsed/duration or distinct total and
overrun values without announcing decorative minute ticks.

This package remains **physical smoke pending**. It is production-code and
automation evidence only; Task 0039 is not marked fully accepted until the short
post-fix Realme checklist passes.

## Realme clock and single-active corrective package — 2026-09-28

Realme video evidence exposed two related runtime defects. Android system time
advanced from 16:18 through 16:20 while the started-card `Сейчас …` row remained
one minute behind, and a scheduled 16:20 card entered its current state from a
different clock snapshot. Starting that card also left the previous card active,
so both showed current time, elapsed progress, and the diagonal fill.

Today now owns one `nowMs` for its whole rendered lifecycle. It reads the real
clock immediately, schedules each wake for the next real system-minute boundary,
and recalculates from `Date.now()` after every wake rather than adding a minute
to stale state. Foreground, Today focus, and timezone-identity changes resync
immediately. Timeline, current marker, task current/due state, internal current
time, elapsed fill, and settling-wave eligibility all consume this same value.
Per-card minute intervals were removed.

The server is the source of truth for one incomplete active started task per
user. Ordinary Start returns a typed `ACTIVE_TASK_CONFLICT` with the current
task's minimal identity. The client offers `Остаться` and an explicit
`Переключиться`; only the latter retries with `confirmSwitch`. A serializable
transaction with retry clears `startedAt` from every other legacy active row and
starts the target at the actual server instant atomically. The prior task is not
completed, deleted, rescheduled, or given a new recurrence identity: it returns
to the existing unstarted/lost-focus representation and follows ordinary overdue
Recovery eligibility. Cache reconciliation covers Today, Plan, and Recovery.

TalkBack's earlier Realme smoke remains passed and is not reinterpreted by this
package. Task 0039 remains **physical smoke pending** until a short Realme retest
confirms the system-minute boundary, simultaneous scheduled transition, Stay,
Switch, prior-task Recovery behavior, single `Сейчас`, Plan → Today, and
restart/background resynchronization.

## Future completion and early-start correction — 2026-09-28

The Realme follow-up exposed that a future task's completion circle still used
the generic optimistic toggle path. That path was the source of the immediate
check, strike-through, and daily-progress increment; Start/Switch itself does
not write completion. The server switch transaction is covered separately and
continues to clear only `startedAt`, leaving the previous task incomplete and
eligible for the ordinary overdue Recovery flow. Mobile switch reconciliation
now identifies the exact conflicted active task and removes any stale optimistic
completion while preserving unrelated completed history.

Today now asks before completing or starting an unstarted future concrete task.
Both dialogs are profile-timezone aware, honor H12/H24, block duplicate taps,
and treat Cancel, Android Back, and backdrop dismissal as no-ops. Confirmed
future completion waits for the canonical response instead of painting an
optimistic result. Confirmed early Start preserves the scheduled instant and
uses the server's actual start instant. The server returns typed
`EARLY_START_CONFIRMATION_REQUIRED`; when both early-start and active-task
confirmation apply, the client performs the two explicit confirmations in
order and sends both flags only on the final retry.

This is a focused correction, not a new competitive-state model. Prior Realme
passes for Plan → Today, warm/dark active state, current time/elapsed state,
TalkBack, diagonal fill/wave, H12/H24, and responsive overdue cards remain the
recorded evidence. Task 0039 remains **physical smoke pending** until the short
device checklist is repeated.

## Physical acceptance close-out — 2026-09-28

The required Realme visual, timeline, lifecycle, recurrence, and accessibility
smoke passed on 2026-09-28. This closes the physical evidence gate left open by
the historical checkpoints above; those checkpoints remain as dated records of
the state before the final retest. Production code, automated verification, and
physical acceptance are separate completed evidence layers for Task 0039.

### Themes and system UI

- Warm and dark remain device-local after logout and cold start; pre-auth routes
  use the saved theme without a white or dark flash.
- StatusBar and Android navigation bar match the active theme. Changing dark to
  warm during an active task preserves its active state.
- A legacy `gray` preference safely resolves to `warm`.

### Quick Capture

- Swipe, backdrop dismissal, and Android Back preserve the local draft, and
  reopening restores it.
- Explicit Cancel, successful submit, and identity change clear the draft.
  After logout, the prior identity's draft does not return.

### Task, Rest, and Timeline

- User-facing BUFFER is rendered as `Отдых`; legacy BUFFER keeps internal
  compatibility. H12 and H24 render without the earlier wraps or collisions.
- Current time, scheduled time, elapsed state, and fill share one wall clock;
  the minute boundary matches Android system time.
- The diagonal area-linear fill and finite settling wave work as specified.
  Overdue fill clamps at 100%, large elapsed values use hour/day formatting,
  and no automatic completion occurs.
- Long titles, Rest, and adjacent cards do not overlap. State changes leave no
  ghost spacing. Increased display scale and maximum text remain readable and
  operable.

### Explicit Start and single-active lifecycle

- A user retains only one active started task. A conflict offers `Остаться` and
  `Переключиться`: Stay preserves the current task and does not start the new
  one; Switch starts the new task and removes active state from the prior one.
- Switch does not complete the prior task and produces no check, strike-through,
  completion animation, or completed-counter increment. The prior task returns
  to the ordinary incomplete state and, under the accepted current policy,
  becomes eligible for Recovery after the next profile day begins.
- Plan → Today, theme switching, background/resume, and restart preserve a
  coherent active state.

### Future-action safeguards

- Early Start asks for confirmation. Cancel is a no-op; `Начать сейчас` records
  the actual `startedAt` while preserving scheduled time as plan context.
- With another active task, the sequence is early-start confirmation, typed
  active-task conflict, then Stay or Switch.
- Future completion shows the scheduled date/time and confirmation. Cancel
  changes neither the task nor the counter; `Выполнено` completes the task and
  increments the counter exactly once.

### Recurrence

- `Всю серию` updates every technical segment of a multi-split recurrence,
  including the original; `Удалить весь повтор` removes the full logical
  lineage.
- Recurrence identity is preserved, including already started or completed
  occurrences. The local lineage migration applied successfully.
- `prisma migrate status` reports 18 migrations and an up-to-date schema.

### Accessibility

- TalkBack announces primary elements, task states, scheduled/current time,
  elapsed state, and overdue semantics; disclosure sections expose the correct
  expanded state.
- Dark system bars show no regression. Reduce Motion and increased text remain
  supported.

### Automated evidence retained for close-out

- Full API Jest: `47 suites / 710 tests — PASS`.
- Full mobile Jest: `81 suites / 943 tests — PASS`.
- Focused corrective suites, API TypeScript, mobile TypeScript, API build, and
  Prisma validate: PASS.
- Prisma migrate status: 18 migrations, schema up to date.
- Expo Android export: PASS, 1485 modules.
- `git diff --check`: PASS. Existing non-fatal `act(...)`/Animated warnings are
  unrelated to this package; the existing CRLF→LF warnings for `focus.tsx` and
  Engineering Handbook are informational.

### Remaining external boundary

Push delivery has not been physically accepted. A working EAS `projectId`,
credentials, and device push token are unavailable, so push-delivery smoke
remains externally blocked and is not represented as passed. The next product
package, `Сейчас по плану / конкурентная модель`, is a new iteration; it is not
implemented and must not be retroactively included in Task 0039.
