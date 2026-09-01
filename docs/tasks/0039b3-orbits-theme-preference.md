# Task 0039 Phase B.3 — Orbits theme preference

**Status:** implemented in source and automated tests on 2026-08-30; Task 0039 and Phase B remain in progress.

## Contract and persistence boundary

The free/default Orbits pack exposes exactly three selectable backgrounds: `warm` (`Тёплая`), `gray` (`Серая`) and `dark` (`Тёмная`). `warm` is the startup default and the fail-closed result for a missing, malformed or unreadable value. A dedicated adapter stores only the exact theme-name string under `focus_orbits_theme` in Expo SecureStore. It is separate from token storage, authentication, user records, API data, subscriptions and entitlements; logout and account changes therefore do not clear it. There is no server or cross-device synchronization.

The Zustand preference boundary exposes the active name, hydration completion, saving state, sanitized save error, one-time bootstrap and selection action. It serializes saves, avoids a write for the active value, and changes the active theme only after persistence succeeds. A failure retains the previous theme and exposes only `Не удалось сохранить оформление. Попробуйте ещё раз.`

## Runtime integration and UX

The root keeps the existing singleton query client, notification lifecycle, auth bootstrap, redirects and Stack routes, while an `OrbitsThemeProvider` supplies the hydrated preference independently of auth. A neutral hydration veil prevents fully loaded warm Today content flashing before a saved dark preference is known.

Settings adds an `Оформление` radio group with always-visible labels and supporting copy, actual-token previews, visible radio/check cues, selected/busy/disabled semantics and 44-unit minimum targets. It does not change the independent time-format, notification or logout flows.

Today remains one production implementation. Its canvas and existing semantic components consume the selected token record; WeekStrip and Today-only empty states are theme-aware, and StatusBar uses light content only for dark. NotificationInvitation, NowCard, RecoverySection, RecoveryBanner and PartialReminderNotice use semantic Orbits surfaces and text roles in warm, gray and dark. Timeline coordinates, 32-unit geometry, overlap, date calculations and task color meaning are unchanged.

## Evidence and scope

Focused storage/store tests cover strict parsing, fail-safe reads, exact persistence, one-time hydration, durable-before-active selection, no-op active selection, sanitized failure and concurrent-write prevention. Focused Settings, Today, Recovery and production-token contrast cases are added as the UI regression boundary. The original Cloud run passed the storage/store tests; the follow-up rendering and contrast cases require CI or a dependency-complete local environment and are not claimed as executed by the GitHub editing workflow.

No route file, fictional `План`/`Успех` destination, five-item navigation, API field, Prisma change, dependency or paid visual pack was introduced. Focus Sparks and Focusiki remain future paid alternative packs; selecting an Orbits background is not billing or entitlement.

Source and simulator-style tests do not establish physical Android/iOS approval, timeline physical touch-target approval, VoiceOver, TalkBack or large-text approval. Those remain explicit gaps.


## Phase B.4 Android emulator follow-up (2026-09-01)

Pixel 7 Android 15/API 35 emulator verification confirmed all three selections
on Today, persistence through Metro reload, and persistence of the gray
preference after the app process was removed and relaunched. The current gray
runtime canvas is `#E7E7EA`, corrected after the previous darker canvas formed
an abrupt split beside `surfacePrimary`.

The same session produced a successful Metro Android bundle and post-fix gray
screenshot. Focused verification passed 3 Jest suites / 17 tests, TypeScript and
`git diff --check`. Removal of the misleading empty-state `○` is covered by a
focused render test; a post-fix empty-state emulator screenshot was not obtained
because the test account has a recurring task on the inspected dates.

This is emulator evidence, not physical-device, TalkBack, VoiceOver, large-text,
reduced-motion, haptic or physical timeline touch-target approval. See
[`0039b4-orbits-android-runtime-verification.md`](0039b4-orbits-android-runtime-verification.md).
