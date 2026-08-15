# Task 0022 — Honest basic recurring tasks

## Supported scope and identities

Completed for exactly `FREQ=DAILY` and
`FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR`. A repeat is a timed root task without subtasks.
The user-authored row remains the stable, non-actionable series template. Every
occurrence has its own UUID, `seriesId`, and profile-local `recurrenceDateKey`.
Occurrence UUIDs are randomly preassigned before insertion and remain stable;
they are not derived deterministically from the calendar date.
The database unique constraint on `(seriesId, recurrenceDateKey)` remains the
cross-request and cross-replica idempotency boundary. Start and completion belong
only to occurrences; occurrence rows never count as free-tier authored tasks.

## Explicit state machine

A non-recurring task may become a series only while it is a timed, root,
unstarted, incomplete task with no subtasks. The conversion, timezone/anchor
snapshot, generated-through boundary, and bounded occurrence insert commit in one
transaction. The template's old reminder is cancelled after commit and only
concrete occurrence reminders are scheduled.

Selecting **«Остановить повтор с сегодняшнего дня»** sets
`recurrenceEndedAt`. The profile-local current-day occurrence stays actionable.
Only untouched occurrences strictly after today are removed; every past, started,
or completed occurrence and UUID remains unchanged. Ended templates remain hidden
as templates, are excluded from renewal, and do not consume an active free-tier
slot. They are not converted into ordinary dated tasks.

Content-only edits update eligible current/future untouched occurrences in place
without moving the anchor or changing UUIDs. Anchor or pattern replacement updates
the series, removes eligible rows, inserts the replacement projection, and updates
`recurrenceGeneratedThrough` inside one transaction. A failure at any point rolls
back metadata, deletion, insertion, and boundary together. Reminder cancellation
and scheduling use returned removed/new concrete IDs only after commit.

## Calendar, timezone, and bounded renewal

A valid stored series timezone is used first, followed by a valid profile IANA
timezone and then an explicitly supplied, validated device IANA timezone. Invalid
stored/profile values are never passed to calendar conversion and UTC is never
silently substituted. Occurrences recombine their calendar key with the stored
wall clock, preserving local time across Moscow/New York DST and month/year edges.

`recurrenceGeneratedThrough` is authoritative. Generation starts after it and
targets profile-local today plus 60 calendar days; an equal boundary performs zero
writes and zero reminder scheduling. Client-selected dates never extend the
horizon. A server-owned 01:00 UTC job renews active series in deterministic pages
of 100 with sequential bounded work. One malformed series is logged without user
content and cannot abort other series. Database uniqueness handles overlapping
replicas.

## Mobile integrity

The form cannot retain recurrence without a time. Choosing a recurrence while
«Без времени» is selected calmly requests a time; removing time explicitly clears
the recurrence. Recurring subtasks remain unavailable in both API and UI.
Occurrence editing carries immutable series anchor/timezone metadata and explicit
anchor/pattern edit flags.

Create, edit, stop, and delete run guarded local-reminder reconciliation and
invalidate the full `tasks` cache prefix when multiple days can change. The guard
combines mounted state, per-mutation identity, user identity, and a monotonic auth
session generation. It is rechecked around every awaited cancellation, lookup,
cache write, and reconciliation; late local scheduling retains exact-ID cleanup.
Remote-primary mode continues to cancel/avoid local duplicates, while local-only
mode immediately schedules concrete occurrences after series creation.

## Legacy policy

The additive migration keeps only timed root rows with supported rules as active
series. Unsupported/missing rules, supported rows without a start time, and
recurring subtasks are converted in place to one visible non-recurring task.
Identity, ownership, title, instant, duration, color, first step, start/completion
state, `createdAt`, and `updatedAt` remain unchanged; only recurrence fields clear.

## Deferred

Arbitrary weekday selection, custom intervals, monthly/yearly recurrence, end-date
UI, edit-only-this-occurrence, recurring subtasks, streaks, missed counters, AI
suggestions, an advanced editor, and a calendar screen remain deferred. Android
runtime validation is not claimed by Jest or TypeScript checks.
