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

### Timed-task correction

The canonical `selectedDateKey` is now passed explicitly from Today to Timeline
and every Today-owned task-form route. A tapped slot combines that key with the
tapped wall-clock fields in the valid profile IANA timezone; task-form creation
uses the same operation. Missing or invalid profile timezones use an explicit
device-local calendar construction rather than UTC. Legacy routes containing
only `selectedDate` remain supported.

Existing tasks and explicit `prefillStartTime` values remain exact instants. If
their displayed wall-clock fields are not changed, saving preserves the complete
original ISO value, including seconds and milliseconds. Thus, for example,
`2026-08-13` at 14:30 in `Europe/Moscow` becomes
`2026-08-13T11:30:00.000Z` and still formats to canonical profile day
`2026-08-13`.

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

- Focused WeekStrip, Today, Timeline, timezone, and task-form coverage: 5 suites,
  122 tests passed.
- Full mobile Jest suite: 31 suites, 414 tests passed (the original published
  baseline was 30 suites / 390 tests).
- Mobile TypeScript compilation and whitespace validation passed.
- Deterministic cases cover seven Monday–Sunday entries, selection/today states,
  canonical taps and return-to-today, month/year edges, real DST transitions,
  profile/device mismatch, and navigation during loading/error/empty states.

## Runtime limitations

No Android emulator or physical device was used. Validation is Jest and static
TypeScript only; therefore this task makes no Android runtime or visual-device
evidence claim.
