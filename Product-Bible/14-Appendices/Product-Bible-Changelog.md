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
