# Task 0039 Phase B.2 — Orbits Today reference screen

## Status and root cause

Phase A is complete, Phase B.1 is merged, and the source-level Phase B.2 reference screen exists with corrective automated checks recorded below. Task 0039 and full Phase B remain in progress. The production Today screen still used an unrelated gray/white palette, hid zero-task progress, lacked semantic progress and retry behavior, and communicated several task states mainly through color.

## Today hierarchy

The route keeps orchestration in `today.tsx`. Its visible hierarchy is: warm safe-area canvas; focused Today header with greeting, selected date, supportive progress, ring, previous/next/Today controls, week strip and `Ваш день`; bounded query state; Recovery; Now/Next and notification invitation; compact unscheduled cards; then empty scheduling state or the existing vertical timeline. GlobalCapture remains the sole global add action.

## Shared theme and greeting

Today consumes `useOrbitsTheme`; no route-local palette exists. The shared contract adds `surfacePrimary`, `surfaceMuted`, `completionPrimary`, `completionSoft`, `rewardPrimary`, `rewardSoft`, `timelineNeutral`, `errorPrimary`, `errorSoft`, `activeSurfaceText`, and `retryText` for warm, gray and dark records. Warm remains the runtime default (`#FCF9F6`); gray/dark remain candidates with no selector or persistence.

The pure greeting helper uses the profile-local hour only for a valid IANA timezone. Missing or invalid timezone uses `Date#getHours`, i.e. device local time, never an implicit UTC substitute. A non-current selected day says `План на день`.

## Progress and task states

Progress is omitted while query data is loading or failed, so unknown data is never represented as zero. Once data is known, progress defensively floors and clamps values and includes a visible `completed из total` (including `0 задач`), a Russian progressbar label/value, and calm zero/partial/complete copy. Completion can use the restrained reward token only alongside explicit text.

Normal task colors are accepted only as six-digit hex, used as a soft alpha surface/accent, and otherwise fall back to brand purple. They do not imply category, priority or urgency. Completed scheduled cards use turquoise plus a visible `✓` and strikethrough, with `Выполнено` announced in the accessibility label. Current cards use a purple outline plus a high-contrast semantic pill with visible/announced `Сейчас`. At the 32-unit minimum height, state cues and the one-line title share one clipped primary row; optional subtask counts are suppressed without changing timeline geometry. Unscheduled cards preserve tap completion and long-press opening with checkbox semantics and a reflowing title. REST and BUFFER retain their explicit labels and known/unknown-duration accessibility copy on calm semantic surfaces. Category and importance visualization is deferred because those fields do not exist in the Task contract.

## Query states and preserved boundaries

Loading exposes a bounded indicator and calm Russian label. Error content never renders or logs the raw error; `Повторить` calls the query `refetch` and is disabled while refetching. Empty copy distinguishes today from another selected date and retains the real task-create action. The all-unscheduled state retains its truthful scheduling action.

Task hooks/API and cache contracts, canonical day keys, recurrence occurrences, timezone geometry, overlap layout, free windows, current task, Now/Next, duplicate start guard, editing, recovery/undo/timezone guard, notification lifecycle, onboarding/auth, timeline capture and GlobalCapture are unchanged. Timeline math and route information architecture are unchanged. Five-item Orbits navigation is not installed; Plan/Success routes do not exist.

## Accessibility and validation evidence

Source tests cover the default theme, actual production contrast pairs, unknown progress, greeting timezone fallback, progress rendering and normalization, retry behavior, unscheduled cards, compact timeline cards and safe color normalization where the Cloud test environment can execute them. Day-navigation and retry controls are at least 44 logical units. Timeline task cards retain the existing 32-unit minimum geometry; their touch-target behavior still requires physical-device/accessibility validation. State is duplicated with text and semantics; no animation, sound or haptics was introduced. Validation is automated/source-level only. No physical-device rendering, Android/iOS approval, large-text exercise, VoiceOver or TalkBack verification was performed; those remain runtime gaps.
