# Task 0021 — Calm seven-day navigation

## Status and scope

Completed. Today now contains one compact Monday–Sunday strip around the selected
calendar day. Each entry shows a short Russian weekday and day number. Selection
uses the primary filled treatment; a small secondary marker identifies today.
The existing previous/next-day arrows and `Сегодня` return action remain.

This is navigation within the existing timeline-centred Today experience. It is
not a Week screen or weekly agenda and adds no task-count/availability queries,
gesture, animation dependency, endpoint, or cache. Loading, error, and empty task
content do not own or disable the strip.

## Calendar and timezone contract

Day identity remains canonical `YYYY-MM-DD`. The profile IANA timezone is used
when valid; otherwise the device calendar day is used. Week construction and
arrows use `addCalendarDays`, while a chosen profile day becomes an instant via
`localMidnightToInstant`. The fallback is device-local midnight. No calendar day
is obtained with `toISOString().slice(0, 10)` or advanced by fixed 24-hour
milliseconds.

This preserves identity at month/year boundaries, across New York spring-forward
and fall-back transitions, and when profile and device zones disagree. The same
selected instant continues into authoritative task hooks, quick create, Timeline,
and task-form navigation without changing the intended profile calendar day.

## Current-day boundary

Now Card, notification invitation, Recovery, progress and timeline auto-scroll
remain current-day-only. A past or future selection is a planning view and does
not present those behaviors as happening now.

## Accessibility

Every day is an accessible tab with a full Russian date label and exposed
`selected` state. Today's full label additionally says `сегодня`, independently
of selection. Entries share the available width, retain a 52-point minimum touch
height, support text scaling through normal `Text` elements, and remain operable
regardless of task-query state.

## Validation

- Focused WeekStrip and Today coverage: 2 suites, 22 tests passed.
- Full mobile Jest suite: 31 suites, 400 tests passed (baseline inventory grew
  from 30 suites / 390 tests to 31 suites / 400 tests).
- Mobile TypeScript compilation and whitespace validation passed.
- Deterministic cases cover seven Monday–Sunday entries, selection/today states,
  canonical taps and return-to-today, month/year edges, real DST transitions,
  profile/device mismatch, and navigation during loading/error/empty states.

## Runtime limitations

No Android emulator or physical device was used. Validation is Jest and static
TypeScript only; therefore this task makes no Android runtime or visual-device
evidence claim.
