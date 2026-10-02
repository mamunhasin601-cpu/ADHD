# Theme System

> Статус: Phase B production rollout code-complete для warm/dark; расширенная physical-device и assistive-technology проверка остаётся незавершённой.
>
> Компонентная реализация, токены и архитектурные ограничения должны быть согласованы с [Frontend](../../docs/Frontend.md), [Architecture](../../docs/Architecture.md) и [Engineering Handbook v5](../../docs/Engineering-Handbook-v5.md), но не дублируются здесь.

## Содержание

### 1. Purpose of themes

#### 1.1 Эмоциональная поддержка

#### 1.2 Ориентация и читаемость

#### 1.3 Персонализация без визуального шума

Focus должен ощущаться как спокойный, но живой напарник: **Focus is calm but
alive**. Тема поддерживает ориентацию и возвращение к действию, а не заменяет
его декоративной настройкой.

### 2. Theme model

#### 2.1 Базовая тема

Базовая тема — **Orbits**, бесплатная и доступная без entitlement. Направление
фона — тёплый светлый вместо холодного чисто-белого. Semantic Orbits tokens,
утверждённые navigation bitmap assets и локальный выбор warm/dark уже
реализованы. Gray сохранён только в истории разработки и безопасно читается как
warm из старого локального значения; пользовательского выбора gray нет.

#### 2.2 Theme packs

Будущие coherent packs применяются последовательно ко всему продукту:

- **Orbits** — free/default, с мягкими орбитальными мотивами;
- **Focus Sparks** — будущая paid alternative с мягкой четырёхлучевой искрой и
  орбитальной точкой;
- **Focusiki** — будущий paid emotional character pack с небольшими, читаемыми
  вариантами персонажа.

Pack меняет визуальный слой, но не скрывает задачи, recovery, undo, reminders
или другие recovery-critical actions. При недоступном entitlement/asset всегда
используется Orbits; пользовательские данные не меняются.

#### 2.3 Theme worlds

#### 2.4 Contextual and time-based variants

#### 2.5 User-created combinations

### 3. Semantic design language

#### 3.1 Semantic colors

- **Purple** — бренд, навигация и primary actions.
- **Turquoise** — спокойный прогресс и завершение.
- **Coral** — важность и срочность, никогда не моральная оценка.
- **Yellow** — награды, streaks и маленькие победы.

Состояние дополнительно сообщается текстом, формой, иконкой, порядком и
доступностью; цвет не является единственным носителем смысла. Одновременное
использование всех акцентов должно быть редким, чтобы не создавать visual noise.

#### 3.2 Typography roles

#### 3.3 Spacing and density roles

#### 3.4 State and feedback roles

#### 3.5 Component neutrality

Карточки, timeline, quick-add и навигация используют единый набор ролей для
spacing, sizing, rounded corners, restrained shadows, typography и states.
Компонент не должен зависеть от конкретного pack или персонажа.

### 4. Companion packs

#### 4.1 Emoji packs

Custom Focus emoji могут обозначать категории задач, mood, energy, focus,
overload, recovery, маленькие победы, streaks и крупные завершения. Они не
заменяют universal system icons и не обязательны для понимания critical actions.

#### 4.2 Icon packs

Focus развивает собственные узнаваемые icons и emotional symbols, но Back,
Close, Add, Delete, Settings и Confirm остаются знакомыми и предсказуемыми.
В долгосрочном auth-направлении placeholder letters вроде `Я`, `ВК` и `@` могут
быть заменены чистыми rounded provider marks; identity и применимые brand rules
сохраняются, а marks не входят в replaceable packs.

#### 4.3 Sound packs

#### 4.4 Animation packs

Анимация остаётся вторичной: завершение может мягко подтвердить действие,
но смысл доступен без неё.

#### 4.5 Haptics and motion

Haptics, sound и motion — опциональные усилители. Reduced motion и отключённые
haptics не убирают состояние, undo или следующий шаг.

Допустимые будущие применения — completion, expansion/collapse карточки,
progress-ring update, короткая celebration, переключение pack и переход между
ясными UI states. Движение короткое, предсказуемое, безопасное при повторе и
отключается системной reduced-motion настройкой.

#### 4.6 Authentication visual direction

Будущий auth-flow может использовать тёплый светлый фон, мягкие градиенты,
restrained color shapes, unified rounded controls и узнаваемые provider marks.
Декор не должен отвлекать от login, registration, recovery или выбора провайдера.
Сохраняется политика Task 0038: показываются только явно доступные providers,
Email/Phone остаётся доступным, discovery fail-closed, а визуальная подача не
делает disabled provider callable. Provider marks не являются частью theme packs.

#### 4.7 Rewards and encouragement

Focus может коротко и искренне отмечать маленькие шаги, возвращение после
пропуска, важную задачу, спокойную серию и recovery после overload. Celebration
не блокирует работу, остаётся optional и не стирает broader progress после
пропущенного дня.

### 5. Accessibility and sensory safety

#### 5.1 Contrast and color independence

Каждая реализация проверяется на контраст, системное масштабирование, малый
экран и non-color cues. Красный/коралловый не используется как наказание за
пропуск или просрочку.

#### 5.2 Reduced motion

Переходы сохраняют причинно-следственную связь в reduced-motion режиме и не
мигают, не запускают бесконечные циклы и не требуют наблюдения.

#### 5.3 Sound and haptic controls

Haptics должны быть subtle, meaningful, optional и independently disableable,
где это уместно. Ни sound, ни vibration не являются единственным подтверждением.

#### 5.4 Cognitive load

На одном состоянии не конкурируют одновременно акцент, reward, character,
animation и несколько равнозначных CTA. Пустые и overload-состояния предлагают
один понятный следующий шаг.

#### 5.5 Accessible fallback theme

Fallback остаётся спокойным, читаемым и функционально полным. Настройки
персонализации должны позволять preview/reset, но не требовать их до действия.
Dark входит в два локально выбираемых Orbits backgrounds. Основные экраны
проверялись на физическом Android, но полный pre-auth/large-text/TalkBack/
VoiceOver acceptance ещё не получен.

### 6. Product and monetization policy

#### 6.1 Free theme baseline

Free включает Orbits и базовую поддержку Focus character. Основной путь
«увидеть → начать → вернуться», recovery и undo не зависят от оплаты.

#### 6.2 Pro theme value

Sparks и Focusiki — будущая дополнительная эмоциональная ценность, а не
функциональный lock. Для коммерческой модели (one-time, subscription или
широкий premium tier) отдельное решение ещё не принято.

#### 6.3 No functional disadvantage through theming

Платный pack не скрывает данные, не ухудшает контраст и не отнимает возможность
отменить, перенести, уменьшить или продолжить план.

#### 6.4 Theme previews and reset

Настройки показывают preview и локально сохраняют только warm/dark внутри
бесплатного Orbits. Reset, загрузка альтернативных packs и entitlement остаются
будущими отдельными контрактами; ошибка будущего pack должна честно возвращать Orbits.

### 7. Content and quality rules

#### 7.1 Tone and emotional fit

Focus character используется для tips, congratulations, recovery после
сорванного плана, empty states и мягкого onboarding. Он optional/non-blocking,
не занимает главный экран постоянно, не требует реакции, не появляется после
каждого обычного действия и не говорит чрезмерно детским голосом. Support
остаётся доступным бесплатно; paid character pack расширяет только варианты.

#### 7.2 Localization

#### 7.3 Asset licensing

#### 7.4 Performance and battery expectations

#### 7.5 Theme review checklist

- [ ] Направление узнаваемо как Focus и не копирует Structured.
- [ ] Today — первый reference screen, а не обещание полного rollout.
- [ ] Проверены contrast, text scaling, touch targets, screen reader, reduced
  motion, sound/haptic opt-out и small-screen composition.
- [ ] Персонаж необязателен, не стыдит и не превращает продукт в детскую игру.
- [ ] Assets лицензированы до использования; provider marks не считаются
  реализованными без отдельного approval.

## 8. Honesty boundary

В Orbits существуют semantic tokens, утверждённые navigation bitmap assets,
пять установленных destinations и локальный выбор warm/dark. Phase B tokens
распространены на основные, вложенные и pre-auth маршруты, Quick Capture,
task form и notification banner. Этот документ не утверждает готовые Theme Worlds, production
Focus Sparks/Focusiki, billing, pricing или entitlement. Physical-device,
VoiceOver, TalkBack и полный large-text approval также ещё не получены.

## Orbits background preference (Phase B.3, 2026-08-30)

Historical Phase B.3 record: at that checkpoint the selectable candidates were
warm, gray and dark. The later Phase B.5 physical review rejected gray; the
current user-selectable backgrounds are exactly warm and dark, with warm as the
default and fallback for any legacy gray preference. The device-local choice is
not billing, entitlement, account synchronization or server state.


## Orbits Android emulator checkpoint (Phase B.4, 2026-09-01)

The current selectable Orbits backgrounds remain warm, gray and dark. The
production gray canvas is now `#E7E7EA`; historical Phase A references to
`#8B8E96` remain candidate-preview history rather than current runtime policy.

Pixel 7 Android 15/API 35 emulator verification confirmed switching all three
backgrounds on Today, persistence through Metro reload, and persistence of the
gray selection after app-process termination and relaunch. A post-fix screenshot
confirms the calmer gray canvas/primary-surface transition. Focused tests confirm
that the Orbits loaded-empty Today state no longer renders the decorative `○`
that Android presented like a stuck spinner.

This is Android emulator evidence only. It does not establish physical Android
or iOS approval, TalkBack, VoiceOver, large-text, reduced-motion, haptic or
physical timeline touch-target approval. A post-fix empty-state emulator
screenshot also remains absent because the test account has a recurring task on
the inspected dates.

## Phase B closure policy (2026-09-26)

- The installed Orbits navigation is `Сегодня | План | Добавить | Успех | Профиль`;
  Add remains an action. Recovery is rendered in Plan and its count remains on
  the Plan orbit without a duplicated external heading.
- The device-local warm/dark preference now covers authenticated routes,
  Quick Capture, task form, pre-auth/provider/onboarding/paywall routes, loading
  overlays, route transition canvases, dialogs and notification permission UI.
  Logout does not reset it.
- Quick Capture preserves its in-memory draft on swipe, Android Back and
  backdrop dismissal; explicit Cancel, successful submit, logout and identity
  change clear it.
- `BUFFER` remains a compatibility value in persistence/API contracts. New UI
  offers one `Отдых` choice, legacy BUFFER records render and edit as `Отдых`,
  and editing preserves their stored value. A destructive data migration is not
  part of Phase B.
- Code and automated-test completion do not constitute Realme, iOS, TalkBack,
  VoiceOver, maximum-text or Android navigation-bar approval.

## Physical acceptance repair policy (2026-09-27)

- Android status/navigation bars are application-controlled semantic surfaces:
  warm uses light surfaces with dark system icons; dark uses dark surfaces with
  light system icons. Runtime OEM verification remains a separate gate.
- Persistent five-item navigation keeps complete single-line labels, stable
  icons and at least 48dp targets. At large system text, its container may grow;
  the timeline viewport yields space instead of overlaying or clipping content.
- Timeline labels and task badges use the user's 12/24-hour preference. H12
  meridiem stays attached to the time token and the gutter expands with text
  scale; it must not wrap into a second line.
- Code/tests/export evidence is not physical acceptance. Realme warm/dark,
  maximum-text, H12 and system-bar checks remain pending until repeated on-device.

## Second corrective visual/accessibility policy (2026-09-27)

- Started progress is a low-contrast semantic wash inside the neutral task
  surface, filled from top to bottom with a thin accent boundary. It is a minute
  snapshot, not continuous motion, and never replaces the completion checkbox.
- Timeline gutter collisions use rendered rectangles and the priority `started
  state → Now → task time → tick`; both text and associated dot/beacon disappear
  together. The rule applies across H12/H24/system formats and text scaling.
- Task, Rest and focused cards reserve content-scaled minimum height through the
  shared elastic transform. Focus-only expansion is removed when the card state
  becomes started/completed or loses focus.
- At the combined extreme font/display setting, WeekStrip may show five ordered
  days around selection and Orbits may cap only its local label multiplier. This
  is a functional fallback, not the normal/increased-text design. All targets
  remain at least 48dp and content stays above the bottom safe/navigation inset.

## Final started-task fill policy (2026-09-27)

- The previously accepted semantic color and low opacity are retained, but the
  progress geometry is diagonal: equal elapsed fractions correspond to equal
  filled area moving from the top-left toward the bottom-right.
- On an actual progress increase the diagonal edge may make one or two small
  settling bends over a finite 1.1 seconds, then remains static. It is never a
  loop and does not restart on hydration or an unrelated render.
- Only the visible active started task is eligible for motion. Background,
  off-screen and system Reduce Motion states update directly to a static fill.
- The SVG overlay is behind copy and controls, ignores pointer input, and is not
  accessibility content. Text and TalkBack remain the authoritative elapsed and
  overtime channels in both warm and dark themes.
