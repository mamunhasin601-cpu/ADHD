# ADR-011 — Smartphone-authoritative floating local time

## Context

The API stores task timestamps as UTC instants while calendar queries,
recurrence projection and timeline geometry depend on an IANA timezone. A stale
profile timezone and device-local formatting can make one task appear at
different wall-clock positions. Recurring tasks additionally need to retain
their local wall time when the user's smartphone changes zones.

## Decision

Add nullable `User.timezoneSyncedAt`. A dedicated authenticated
`PATCH /users/me/timezone` accepts one validated IANA `timezone`.

- `timezoneSyncedAt IS NULL`: adopt the smartphone timezone and mark the profile
  synchronised without rewriting ambiguous legacy one-off timestamps; an active
  recurrence projection may be aligned to its explicit series-local anchor.
- already synchronised and unchanged timezone: perform no task or reminder work.
- already synchronised and changed timezone: in one database transaction update
  the profile, re-anchor active recurrence templates, and update future,
  unstarted, incomplete timed plan rows in place while preserving their old-zone
  calendar date and wall clock.

Occurrence identity remains `(seriesId, recurrenceDateKey)` and existing UUIDs
remain stable. Started, completed and non-future rows are immutable. Reminder
jobs for moved actionable tasks are cancelled/recreated after commit.

Mobile owns lifecycle delivery of the device IANA zone. It synchronises after
authentication and on foreground, updates the canonical auth-store user, clears
timezone-dependent query state, and reconciles local-only reminders. Every
visible time surface formats with the canonical profile zone.

New verified registrations that supply a timezone set `timezoneSyncedAt` in the
same user-creation transaction. OAuth-created users remain unsynchronised until
the authenticated mobile lifecycle supplies its zone.

## Alternatives

1. **Use each client's local timezone.** Rejected because surfaces and devices
   disagree and a misconfigured laptop changes the plan.
2. **Keep an immutable account timezone.** Rejected because travelling users
   want recurring tasks at the same local wall time.
3. **Rewrite legacy timestamps on first sync.** Rejected because their original
   wall-clock intent is unknowable after inconsistent historical rendering.
4. **Delete and regenerate recurring occurrences.** Rejected because it changes
   UUIDs and weakens task/reminder identity.

## Consequences

- Requires an additive migration and regeneration of Prisma Client.
- Timezone changes may update many bounded future rows, but recurrence is already
  limited to a 60-day projection.
- Queue reconciliation remains a post-commit secondary effect, matching existing
  task mutation behavior.
- A future web client must use profile timezone plus server-relative UTC time and
  must not overwrite the smartphone-authoritative zone.

## Status

Accepted for implementation on 2026-09-12 by the Product Owner.
