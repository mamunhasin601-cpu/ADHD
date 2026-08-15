# Task 0022 — Honest basic recurring tasks

## Status and bounded scope

Focus supports exactly two server-owned patterns: `FREQ=DAILY` (every profile
calendar day) and `FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR` (Monday–Friday). A series must
be timed. The API rejects missing anchors, recurring subtasks, inconsistent flags,
and every other RRULE; client text is never executed as an arbitrary rule.

The user-authored `Task.id` is the stable **series identity** and is a non-actionable
template. Each materialized task has its own UUID, `seriesId`, and profile-local
`recurrenceDateKey` (`YYYY-MM-DD`). The database unique constraint on
`(seriesId, recurrenceDateKey)`, deterministic generation, and `createMany` with
`skipDuplicates` make retries and concurrent extension idempotent. Start and
completion timestamps live only on occurrences. Series templates are excluded
from dated Today results, so acting on one day cannot mutate later days.

## Calendar, timezone, and horizon contract

Creation snapshots the valid profile IANA timezone and derives the anchor calendar
day and wall clock from the submitted instant. Each occurrence recombines its
calendar key and that wall clock in the snapshot timezone. It therefore preserves
wall time through DST and preserves day identity across month/year boundaries; it
is not a 24-hour UTC loop. Missing or invalid profile zones are rejected with an
explicit request to refresh the profile from the device, rather than substituting
UTC. The existing mobile device-local fallback remains the producer of the anchor
instant when profile timezone is unavailable.

Generation is bounded to the anchor plus 60 calendar days. Creation invokes it;
`POST /tasks/recurrence/extend` (all owned series around the selected day) and
`POST /tasks/:id/recurrence/extend` are explicit idempotent lifecycle extension
mechanisms. GET is read-only and never creates rows. Legacy supported recurring
rows remain their original series identity; the additive migration snapshots the
owner timezone and they enter the same explicit extension path without copying or
orphaning the row.

## Limits, reminders, recovery, and mutation scope

One series is one free-tier task: plan counts exclude occurrence rows. Every
concrete occurrence in the bounded horizon is passed through the existing Focus
reminder-channel scheduler. Series edit/delete first cancels Focus-owned reminders
for all materialized occurrences; edit replaces the bounded projection and delete
removes it by cascade. Mobile edit and delete explicitly say the whole repeat is
affected. “Only this occurrence” editing is not offered.

Recovery sees occurrences as normal independently actionable tasks and never the
series template. Rescheduling one occurrence therefore changes only that row.
Existing non-recurring task CRUD, Today date keys, WeekStrip, Now Card, progress,
and notification invitation keep their existing paths.

## Explicitly deferred

Arbitrary weekday selection, custom intervals, monthly/yearly recurrence, end
dates, editing only one occurrence, streaks, missed counters, AI suggestions, an
advanced recurrence editor, and a calendar screen are deferred. Android runtime
validation is not claimed by Jest or TypeScript checks.
