# Task 0039 Phase B.3 — Orbits theme preference

**Status:** implemented in source and automated tests on 2026-08-30; Task 0039 and Phase B remain in progress.

## Contract and persistence boundary

The free/default Orbits pack exposes exactly three selectable backgrounds: `warm` (`Тёплая`), `gray` (`Серая`) and `dark` (`Тёмная`). `warm` is the startup default and the fail-closed result for a missing, malformed or unreadable value. A dedicated adapter stores only the exact theme-name string under `focus_orbits_theme` in Expo SecureStore. It is separate from token storage, authentication, user records, API data, subscriptions and entitlements; logout and account changes therefore do not clear it. There is no server or cross-device synchronization.

The Zustand preference boundary exposes the active name, hydration completion, saving state, sanitized save error, one-time bootstrap and selection action. It serializes saves, avoids a write for the active value, and changes the active theme only after persistence succeeds. A failure retains the previous theme and exposes only `Не удалось сохранить оформление. Попробуйте ещё раз.`

## Runtime integration and UX

The root keeps the existing singleton query client, notification lifecycle, auth bootstrap, redirects and Stack routes, while an `OrbitsThemeProvider` supplies the hydrated preference independently of auth. A bounded neutral loading veil prevents fully loaded warm Today content flashing before a saved dark preference is known.

Settings adds an `Оформление` radio group with always-visible labels and supporting copy, actual-token previews, visible radio/check cues, selected/busy/disabled semantics and 44-unit minimum targets. It does not change the independent time-format, notification or logout flows.

Today remains one production implementation. Its canvas and existing semantic components consume the selected token record; WeekStrip and Today-only empty states are theme-aware, and StatusBar uses light content only for dark. The audit covers header/progress, loading/error/empty and unscheduled states, Now and Recovery surfaces, notification invitation, timeline task/plan/free-window/hour presentation. Timeline coordinates, 32-unit geometry, overlap, date calculations and task color meaning are unchanged.

## Evidence and scope

Focused storage/store tests cover strict parsing, fail-safe reads, exact persistence, one-time hydration, durable-before-active selection, no-op active selection, sanitized failure and concurrent-write prevention. Existing Settings and Today suites remain the regression boundary.

No route file, fictional `План`/`Успех` destination, five-item navigation, API field, Prisma change, dependency or paid visual pack was introduced. Focus Sparks and Focusiki remain future paid alternative packs; selecting an Orbits background is not billing or entitlement.

Source and simulator-style tests do not establish physical Android/iOS approval, timeline physical touch-target approval, VoiceOver, TalkBack or large-text approval. Those remain explicit gaps.
