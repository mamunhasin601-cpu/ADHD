# Product Decision Records

> Статус: структура и оглавление.
>
> Архитектурные решения оформляются в [ADR](../../docs/ADR/README.md). Этот документ предназначен только для продуктовых решений и их последствий.

## Содержание

### 1. Purpose and scope

#### 1.1 Что считается продуктовым решением

#### 1.2 Что должно быть ADR

#### 1.3 Когда достаточно обновить существующий документ

### 2. Decision record structure

#### 2.1 Context

#### 2.2 User problem

#### 2.3 Options considered

#### 2.4 Decision

#### 2.5 Expected outcome

#### 2.6 Risks and trade-offs

#### 2.7 Evidence and confidence

#### 2.8 Owner and review date

#### 2.9 Status and supersession

### 3. Decision classes

#### 3.1 Vision and positioning

#### 3.2 User philosophy

#### 3.3 UX and interaction

#### 3.4 ADHD safety

#### 3.5 Smart Planner and AI behavior

#### 3.6 Monetization

#### 3.7 Roadmap and platform

#### 3.8 Themes and personalization

### 4. Evidence quality

#### 4.1 Observation

#### 4.2 Hypothesis

#### 4.3 Validated insight

#### 4.4 Product assumption

#### 4.5 Unknown

### 5. Review and change

#### 5.1 Review cadence

#### 5.2 Trigger for reopening

#### 5.3 Rollback or supersession

#### 5.4 Cross-reference requirements

### 6. Index

#### 6.1 Active decisions

- [PDR-001: Timeline-centered day experience](PDR-001-Timeline-Centered-Day-Experience.md)
  — принято 2026-08-12; задает таймлайн как основу Today, приоритет «Сейчас»,
  recovery без стыда и границу между вдохновением Structured и копированием.
- [PDR-002: User-controlled time format](PDR-002-User-Controlled-Time-Format.md)
  — принято 2026-08-12; дает пользователю независимый от языка и часового пояса
  выбор системного, 24-часового или 12-часового отображения времени во всем Focus.
- [PDR-003: Smartphone-authoritative local time](PDR-003-Smartphone-Authoritative-Local-Time.md)
  — принято 2026-09-12; смартфон задаёт актуальную IANA-зону аккаунта, а
  будущие повторения сохраняют пользовательское местное wall-clock время.

#### 6.2 Superseded decisions

#### 6.3 Open decisions

- Точная визуальная композиция Today и карточки «Сейчас».
- Финальная модель постоянной нижней навигации после проверки прототипа.
- Граница Free/Pro для расширенного помощника без ограничения базового recovery.
- Коммерческая модель visual packs: one-time purchase, subscription или часть
  более широкого premium tier.
- Финальные color/spacing/type tokens, assets и approval criteria для Orbits,
  Focus Sparks и Focusiki после Today mockup.

#### 6.4 Approved direction with planned implementation

Task 0039 утверждает направление **Focus is calm but alive**: тёплый светлый
фон, семантическая палитра, Orbits как free/default и Today как первый reference
screen. Это не PDR о runtime-реализации; rollout, packs, billing и entitlement
требуют отдельных evidence gates.

## 2026-08-30 — Orbits background choice is local, not an entitlement

Warm, gray and dark are included user-selectable backgrounds in the free/default Orbits pack. The choice stays on the device across logout/account changes, fails safely to warm, and is independent of authentication and API data. Focus Sparks and Focusiki remain future paid packs. This decision does not claim physical-device validation or completion of Task 0039/Phase B.

## 2026-09-26 — Phase B runtime decisions supersede the three-theme checkpoint

- User-selectable Orbits themes are now exactly warm (`Светлая тема`) and dark;
  gray is historical and any legacy gray preference falls back to warm.
- The local theme is device-owned, applies before authentication and survives
  logout/account changes. It is not copied to the API or billing state.
- Orbits navigation is `Сегодня | План | Добавить | Успех | Профиль`; Recovery
  belongs to Plan and the Plan orbit owns its badge.
- Quick Capture preserves an in-memory draft on implicit dismissal (swipe,
  Android Back, backdrop) and clears it on explicit Cancel, successful submit,
  logout or identity change.
- BUFFER is no longer a separate product-facing type. REST and legacy BUFFER are
  presented as `Отдых`; persisted BUFFER remains supported and is not silently
  rewritten without a separately reviewed migration.
- These are production/code decisions. Physical Realme validation of the new
  pre-auth flow, draft lifecycle, legacy data path and system bars remains open.

## 2026-09-27 — Recurrence scope and elastic Today timeline

- A materialized recurring occurrence is edited with an explicit scope:
  `ONLY_THIS`, `THIS_AND_FUTURE`, or `ENTIRE_SERIES`. A future-branch edit splits
  on the selected profile-local date, retains the prior branch/history, preserves
  started/completed UUIDs and state, and regenerates only replaceable projection
  rows in the same IANA timezone and local wall clock.
- Today remains a time-oriented view. Dense content uses a shared accumulated
  piecewise `displayY(realTime)` displacement for tasks, Rest, completed state,
  NowCard, ticks, current time, free windows and auto-scroll. Real overlaps keep
  calendar columns; minimum content height moves later chronological content.
- These decisions are implemented and covered by automation, but the Realme
  recurrence/dense-timeline/large-text matrix remains a physical evidence gate.

## 2026-09-27 — Second physical corrective package

- A user-authored recurrence owns a durable `recurrenceRootId` independent of
  replaceable technical `seriesId` segments. Every split and occurrence inherits
  it; `ENTIRE_SERIES` update/delete resolves every segment in that logical family.
  Legacy rows without the field retain local-series behavior, while the forward
  migration backfills templates, occurrences and safely identifiable old split
  chains. Started/completed occurrences remain canonical during edits.
- Gutter labels resolve by measured layout bounds, not time-distance guesses:
  internal started state → current-time marker → task start badge → clock tick.
  A losing label and its dot/beacon are removed together.
- Explicitly started tasks with known duration show calm top-to-bottom elapsed
  fill and a one-minute snapshot. Overtime is capped visually at 100% and named
  `Дольше запланированного`; unknown duration, completed tasks and merely overdue
  unstarted tasks never infer progress.
- Timeline expansion follows the currently rendered state. Starting, completing
  or unfocusing a rich NowCard immediately releases its focus-only height and
  recomputes every dependent layer.
- Normal and increased accessibility settings retain the complete layout. Only
  the combined extreme font/display case may use the documented local fallback:
  five visible week days and a locally capped Orbits label scale. Content remains
  scrollable, ordered and reachable.
- These are code/automation decisions. The second Realme retest remains pending.

## 2026-09-27 — Final Task 0039 timeline corrective decision

- Explicit Start does not replace scheduled context: the card keeps scheduled
  start/duration and adds exactly one internal current-time/elapsed line. The
  external Now beacon yields while current time is inside that measured card.
- Elapsed presentation is derived only from persisted explicit `startedAt`.
  Valid old starts retain lifecycle semantics; their totals are compacted into
  minutes, hours/minutes, or days/hours, with total elapsed and overrun named
  separately. Merely overdue schedules never become started.
- The accepted low-contrast wash progresses monotonically by area from top-left
  to bottom-right. A progress increase may run one finite 1.1-second settling
  wave; hydration and ordinary rerenders do not replay it. Reduce Motion,
  background and off-screen states render the static diagonal result.
- The wave is decorative. TalkBack receives title, state, scheduled/current
  times and elapsed semantics, and minute refresh does not create a live-region
  announcement loop.
- The Realme post-fix smoke remains an open evidence gate; Task 0039 is not yet
  fully accepted.

## 2026-09-28 — One wall clock and one active started task

- Realme video evidence showed a one-minute split between Android system time,
  the internal `Сейчас …` row, scheduled-current state, marker, elapsed fill,
  and progress. Today now owns one real-time `nowMs` snapshot, aligns refresh to
  the next system-minute boundary, and resynchronizes after late JS wake,
  foreground, Today focus, and timezone-identity changes.
- One user may have only one incomplete active started task. Starting another
  first returns a typed conflict naming the current task. `Остаться` preserves
  it; an explicit `Переключиться` atomically removes active focus from prior
  tasks and starts the target at the actual server instant.
- Switching never auto-completes, deletes, reschedules, or changes recurrence
  identity. The previous task re-enters the existing lost-focus presentation
  and normal overdue Recovery lifecycle; no incompatible parallel state model
  was added.
- TalkBack remains physically smoke-verified on Realme. Task 0039 stays
  **physical smoke pending** until the clock-boundary and switching smoke is
  repeated on the device.

## 2026-09-28 — Future actions require explicit confirmation

- A scheduled instant remains plan context, not evidence of action. Completing
  or starting an unstarted future concrete task requires an explicit dialog;
  Cancel, Android Back, and backdrop dismissal preserve the source state.
- Confirmed future completion does not use optimistic completion UI. The task,
  daily progress, Today, Plan, and Recovery reconcile from the canonical API
  result, and failure remains retryable.
- Early Start is a server boundary as well as a UI guard. The typed
  `EARLY_START_CONFIRMATION_REQUIRED` protocol composes with
  `ACTIVE_TASK_CONFLICT`: early confirmation comes first, then active-task
  confirmation, and mutation occurs only after both.
- Switch never means completion. The prior task loses `startedAt`, keeps
  `completedAt = null`, preserves schedule and recurrence identity, and follows
  the existing overdue Recovery lifecycle. No separate parallel or competitive
  task-state model is introduced.
- Task 0039 remains **physical smoke pending**.

## 2026-09-28 — Task 0039 physical acceptance close-out

- The required Realme visual/timeline/accessibility smoke passed. Warm/dark and
  pre-auth theming, system bars, Quick Capture draft ownership, Rest/legacy
  BUFFER, H12/H24, the shared minute-boundary clock, diagonal elapsed fill,
  dense/large-text layout, Reduce Motion, and TalkBack behavior are accepted.
- The single-active lifecycle is accepted: Stay preserves the current task;
  Switch starts the new task without completing the prior task or changing the
  completed counter. The prior task follows ordinary incomplete and
  next-profile-day Recovery policy. Plan/Today, theme, resume, and restart state
  remain coherent.
- Early Start and future completion require explicit confirmation. Their Cancel
  paths are no-ops; accepted mutations preserve scheduled context and reconcile
  one canonical completion increment. Multi-split whole-series recurrence and
  deletion preserve the logical lineage and protected occurrence identity.
- Production code and automation are complete; the retained close-out evidence
  is API `47/710`, mobile `81/943`, focused suites, both TypeScript checks, API
  build, Prisma validate/status (18 migrations, up to date), and Android export
  (1485 modules), all passing.
- This acceptance closes Task 0039 within Visual Identity Phase B and the later
  Timeline corrective packages. Push-delivery smoke is still externally blocked
  by the missing working EAS `projectId`, credentials, and device push token and
  is not treated as passed.
- `Сейчас по плану / конкурентная модель` is a new product iteration outside
  Task 0039; its later Task 0041 implementation is not added retroactively to
  this accepted decision.

## 2026-09-30 — Planned time is not actual work (Task 0041)

- `Сейчас по плану` is a derived presentation state for an unstarted task whose
  scheduled interval contains the shared wall-clock instant. It is not stored.
- Only explicit Start creates `startedAt`, `Выполняется`, elapsed time, diagonal
  fill, and settling motion. Scheduled time never claims actual work.
- When an unstarted interval ends it becomes the neutral `Не начато`; after the
  next profile-day boundary, the existing Recovery rules remain authoritative.
- Active A and planned-now B may coexist. A remains the only active task;
  starting B reuses Stay/Switch and never completes A.
- Multiple legacy overlapping tasks may be planned-now. Existing elastic lanes
  remain visible and one `Задачи пересекаются` label describes each connected
  group without weakening server conflict validation.
- Scheduled-start notification copy is `По плану сейчас: «Название задачи»`.
  Redis jobs remain title-free; the worker reloads canonical content at delivery
  and suppresses deleted, rescheduled, started, completed, and non-task rows.
  The task title and route identity are intentionally visible in the delivery
  payload so the invitation is specific and opens the correct Today card.
- This decision is Task 0041 only. Task 0039 remains Accepted from 2026-09-28.

## 2026-10-02 — Task 0041 physical acceptance close-out

- Task 0041 is **Accepted from 2026-10-02**. The Realme smoke physically
  confirmed `Запланировано` → `Сейчас по плану` → `Не начато`, explicit Start as
  the only path to `Выполняется`, and the absence of false `startedAt`, elapsed,
  fill, or settling motion before Start.
- Background/resume preserved the running task and resynchronized the derived
  state at the minute boundary without manual refresh. Maximum font/display
  scale remained operable, and TalkBack distinguished the planned, running,
  missed, and Start-action semantics.
- The existing Stay/Switch decision remains authoritative for active A plus
  planned-now B. Device evidence confirmed that Stay preserves A, Switch makes B
  the only running task, neither path falsely completes A, and the completion
  counter is unchanged by the conflict decision.
- The legacy overlap label is accepted on automated evidence only; no suitable
  legacy overlap pair was available for a separate Realme smoke.
- Real push delivery remains blocked by missing working EAS `projectId`,
  credentials, and device push token. Programmatic copy, suppression,
  idempotency, and routing evidence is retained, and the external device-push
  gate does not block Task 0041 acceptance.
- Task 0039 remains Accepted from 2026-09-28 and is not reopened or extended by
  this close-out.
