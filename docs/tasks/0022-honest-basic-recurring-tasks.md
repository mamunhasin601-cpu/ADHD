# Task 0022 — Honest basic recurring tasks

## Status and supported scope

Completed for exactly `FREQ=DAILY` and
`FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR`. A repeat is a timed root task. The API rejects
all other new rules, inconsistent flags, and recurring subtasks. The mobile form
hides the subtask controls after recurrence is selected and explains calmly that
steps are not yet available for repeating tasks.

The user-authored `Task.id` is the stable, non-actionable series identity. Every
occurrence has its own UUID, `seriesId`, and profile-local `recurrenceDateKey`.
The unique `(seriesId, recurrenceDateKey)` database constraint plus
`createMany(skipDuplicates)` protects concurrent generation. Start and completion
belong only to occurrences; generated rows do not count as free-tier authored
tasks.

## Calendar, timezone, and bounded renewal

The series stores its anchor instant, calendar key, wall clock, and timezone
snapshot. A valid profile IANA timezone is preferred. If it is missing or invalid,
the API accepts the mobile request's explicitly supplied, validated device IANA
timezone. UTC is never substituted silently, and creation is rejected only when
neither candidate is valid. Occurrences recombine local calendar keys with the
stored wall clock, preserving Moscow/New York wall time through DST and preserving
month/year identity.

`recurrenceGeneratedThrough` is authoritative. Generation starts only after that
boundary and targets profile-local today plus 60 calendar days. An equal boundary
is a zero-write, zero-reminder no-op. A client-selected future date is not a
materialization authority. The authenticated lifecycle endpoint may request a
check, but the server computes its own boundary. A server-owned UTC 01:00 daily
scheduler renews every active series independently of app navigation. History is
retained indefinitely; only future materialization is bounded.

## Series edits, reminders, and cache integrity

Series changes are effective from profile-local today. Completed, started, and
past occurrences survive byte-for-byte. Content-only changes update eligible
future untouched occurrences in place, retaining UUIDs and the original series
anchor. The occurrence edit payload carries the immutable series anchor/timezone;
only explicit wall-clock or pattern controls set the dedicated recurrence-edit
flags. Schedule changes replace only eligible future untouched rows.

The series update and eligible occurrence writes run in one database transaction.
Reminder cancellation/scheduling happens only after commit and only for affected
or newly inserted occurrence IDs. Delete returns every affected occurrence ID.
Mobile cancels those exact Focus-owned local notification IDs with the Task 0020
user/lifecycle guard and invalidates the entire `tasks` React Query prefix so
previously visited dates cannot retain stale occurrences. BullMQ cleanup follows
the same concrete IDs. Recovery continues to mutate only a selected occurrence.

## Legacy policy

The additive migration turns supported legacy rows into series in place and
snapshots their owner's timezone. A previously accepted unsupported or missing
rule is converted in place to one visible non-recurring task: identity, ownership,
title, instant, duration, color, first step, start/completion state, and timestamps
remain unchanged; only recurrence fields are cleared. Nothing is hidden, copied,
or deleted.

## Deferred

Arbitrary weekday selection, custom intervals, monthly/yearly recurrence, end
dates, edit-only-this-occurrence, recurring subtasks, streaks, missed counters,
AI suggestions, an advanced editor, and a calendar screen remain deferred.
Android runtime validation is not claimed by Jest or TypeScript checks.
