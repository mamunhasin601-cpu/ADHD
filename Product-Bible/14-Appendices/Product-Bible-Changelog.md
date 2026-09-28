# Product Bible Changelog

> Статус: структура и оглавление. Это история продуктовых изменений, а не источник текущего runtime-состояния.

## Содержание

### 1. Changelog rules

#### 1.1 Что считать продуктовым изменением

#### 1.2 Как ссылаться на решение

#### 1.3 Как отмечать superseded content

#### 1.4 Что не переносить из engineering changelogs

### 2. Entry format

#### 2.1 Date

#### 2.2 Change summary

#### 2.3 Reason and evidence

#### 2.4 User impact

#### 2.5 Roadmap impact

#### 2.6 Engineering cross-reference

### 3. Release history

#### 3.1 Product vision changes

#### 3.2 UX and ADHD principle changes

#### 3.3 Smart Planner and AI changes

#### 3.4 Monetization changes

#### 3.5 Theme system changes

#### 3.6 Roadmap changes

### 4. Review index

#### 4.1 Active entries

#### 4.2 Superseded entries

#### 4.3 Open follow-ups

## 2026-08-12 — Timeline-centered day experience

### Change summary

- принят [PDR-001](../12-Decisions/PDR-001-Timeline-Centered-Day-Experience.md);
- UX Principles переведены из структуры в активную спецификацию;
- Product Experience Model дополнен циклом «Сейчас → действие → recovery»;
- добавлена [Future Screen Map](../05-Experience/Future-Screen-Map.md);
- уточнены Smart Planner и Phase 1 roadmap.

### Reason and evidence

Сравнительный разбор Structured показал сильную модель дня через вертикальный
таймлайн. Решение принято только в той части, которая подтверждается Founder
Manifesto, User Bible, Product Vision и Constitution. Точная визуальная
композиция остается гипотезой для прототипирования.

### User impact

Будущий Focus ориентируется на текущий момент и доступный шаг, отображает
реалистичную емкость дня и помогает пересобрать остаток плана без обвинения.

### Roadmap impact

Минимальное таймлайн-ядро закреплено в Phase 1. Расширенный помощник, энергия,
AI-декомпозиция и body doubling поставляются последовательно и не блокируют
проверку основного опыта.

## 2026-08-26 — Focus visual identity and personalization foundation

### Change summary

- добавлен [Task 0039](../../docs/tasks/0039-visual-identity-foundation.md);
- Theme System переведён в policy для направления **Focus is calm but alive**;
- UX, ADHD, Today Screen Map, Monetization и Feature Roadmap получили связанные
  правила для Orbits, будущих Sparks/Focusiki и первого reference screen Today.

### Reason and evidence

Это согласование продуктового направления, а не evidence готового UI. Mockup,
accessibility-проверки и approval должны предшествовать implementation.

### User impact

Будущий Focus получает тёплую, взрослую и живую визуальную опору без перегрузки,
стыда или функционального paywall. Core path и recovery остаются бесплатными.

### Roadmap impact

Task 0039 идёт через Phase A (spec), Phase B (Today-first implementation) и
отдельную Phase C (packs/monetization). Коммерческая модель visual packs остаётся
открытой.

## 2026-08-30 — Orbits theme preference

- Documented the device-local warm/gray/dark background preference in the free/default Orbits pack and its warm fail-safe.
- Clarified that selection is not billing, entitlement, account synchronization or server persistence; logout retains it.
- Kept Focus Sparks and Focusiki as future paid alternative packs and Task 0039/Phase B in progress.
- Recorded that source/test evidence is not physical-device, VoiceOver, TalkBack or large-text approval.


## 2026-09-01 — Orbits Android emulator verification

- Verified warm, gray and dark Today backgrounds on a Pixel 7 Android 15/API 35
  emulator, including Metro reload and persistence after app-process removal.
- Replaced the harsh gray runtime canvas with `#E7E7EA` and removed the
  decorative Today empty-state `○` that appeared like a stuck loader.
- Recorded successful focused Jest (3 suites / 17 tests), TypeScript,
  `git diff --check` and Metro Android bundle evidence.
- Kept the evidence boundary explicit: no physical-device, TalkBack, VoiceOver,
  large-text, reduced-motion, haptic or physical timeline touch-target approval
  is claimed; no post-fix empty-state emulator screenshot was obtained.

## 2026-09-26 — Task 0039 Phase B code closure

- Recorded the installed five-destination Orbits navigation and Recovery's Plan
  placement/badge ownership.
- Replaced the historical warm/gray/dark user model with warm/dark; legacy gray
  safely falls back to warm and logout does not reset the device-local choice.
- Extended Orbits tokens to pre-auth/provider/onboarding/paywall, index/loading
  canvases, the hidden Focus placeholder and notification permission banner.
- Documented Quick Capture's preserve-on-implicit-dismiss and
  clear-on-Cancel/success/session-boundary policy.
- Unified product-facing BUFFER with REST as `Отдых` while retaining stored/API
  compatibility and deferring destructive migration.
- Marked Phase B code and automated regression scope complete while keeping
  Realme, system navigation bar, TalkBack/VoiceOver and large-text acceptance
  explicitly open.

## 2026-09-27 — Task 0039 physical acceptance defect repair

- Propagated the Today-selected date through global Add while keeping Thoughts
  deliberately undated.
- Added explicit occurrence, future-branch and whole-series recurrence edit
  scopes with local-date/DST-safe projection replacement and protected history.
- Adopted one elastic timeline transform for cards, ticks, Now, gaps and scroll;
  added readable Rest metadata and non-breaking H12 labels.
- Made the five-item navigation, Today header, forms and login responsive to
  large text, safe areas and the keyboard; added warm/dark Android system-bar
  control on the existing Expo SDK.
- Kept physical Realme acceptance open and recorded push as blocked by missing
  real Expo/EAS project identity/credentials. No placeholder infrastructure was
  introduced.

## 2026-09-27 — Task 0039 second physical corrective package

- Added `recurrenceRootId` and a forward backfill migration so whole-series
  update/delete spans multiple technical splits while legacy rows degrade safely.
- Added geometry-based gutter collision priority and explicit started-task
  elapsed/overtime presentation with minute refresh and TalkBack labels.
- Made elastic focus height state-specific and added content-scaled cards plus
  the five-day/local-nav-cap fallback for combined extreme accessibility scale.
- Preserved prior accepted behaviors and kept the six-theme Realme retest and
  real Expo/EAS push identity/credentials as external evidence blockers.

## 2026-09-27 — Task 0039 final physical corrective package

- Recorded the latest Realme passes without rewriting earlier checkpoints and
  kept final acceptance pending a short post-fix device smoke.
- Kept scheduled time/duration visible after explicit Start, moved the current
  time into one stable internal elapsed line, and confined the external Now
  beacon and its orbit to non-conflicting measured gutter bounds.
- Confirmed by read-only inspection that extreme elapsed totals are valid old
  explicit starts; preserved those records and compacted display into
  minute/hour/day units with separate total and overrun semantics.
- Replaced the vertical progress wash with an area-linear diagonal wash and one
  finite settling wave, including Reduce Motion, background/off-screen and
  TalkBack behavior, without adding a production dependency.

## 2026-09-28 — Task 0039 Realme clock and active-task correction

- Recorded the Realme video defect where system time advanced one minute ahead
  of the Timeline's internal current-time row and task-state transition.
- Adopted one Today-owned wall clock aligned to real minute boundaries, with
  immediate foreground, focus, timezone, and late-wake resynchronization.
- Adopted a server-authoritative one-active-task rule with typed conflict,
  explicit Stay/Switch dialog, atomic confirmed switch, and legacy multiple-start
  cleanup without automatic completion or recurrence mutation.
- Preserved the earlier TalkBack Realme pass and kept Task 0039 physical smoke
  pending for the focused clock-boundary and task-switching retest.

## 2026-09-28 — Future completion and early-start correction

- Recorded the source separation between Start/Switch and the optimistic
  completion toggle; strengthened switch reconciliation so the exact prior
  active task remains incomplete without reopening legitimate completed history.
- Added future-completion confirmation with no pre-confirmation or pending
  optimistic paint, canonical success reconciliation, retryable failure, and
  no-op Cancel/Back/backdrop behavior.
- Added profile-timezone-aware early-Start confirmation plus the typed server
  protocol and ordered composition with the existing active-task conflict.
- Preserved prior Realme passes, avoided the separate competitive-model package,
  and kept Task 0039 `physical smoke pending`.

## 2026-09-28 — Task 0039 physical acceptance close-out

- Recorded completion of production code and automation and the passing Realme
  theme, Quick Capture, Timeline, lifecycle, recurrence, system-bar, large-text,
  Reduce Motion, and TalkBack acceptance matrix.
- Accepted Task 0039 within Visual Identity Phase B and the subsequent Timeline
  corrective packages without rewriting the earlier dated checkpoints.
- Kept push-delivery smoke explicitly blocked by the missing working EAS
  `projectId`, credentials, and device push token; no push pass is claimed.
- Recorded `Сейчас по плану / конкурентная модель` as a new, unimplemented
  product iteration outside Task 0039.
