# Task 0040 — Smartphone-authoritative floating local time

## Status

Implemented in the current feature branch on 2026-09-12. Static and automated
verification is complete. Physical Android verification confirms smartphone
timezone adoption and consistent task time across Today surfaces. A real device
timezone change and recurring wall-clock behavior across zones remain covered
by automated tests only. No push, PR, merge or deployment is part of this
checkpoint.

## 1. Task summary

Make the authenticated smartphone the source of the account's IANA scheduling
timezone, remove cross-surface timezone disagreement, and preserve local
wall-clock intent for future recurring and ordinary plan entries after later
timezone changes.

## 2. User problem

A physical Android run showed the same task at 10:45 in the editor/timeline and
14:45 in NowCard. The profile stored `GMT`; the phone reported
`Europe/Samara`. A trustworthy planner cannot show two times for one task, and a
recurring 10:00 task must remain 10:00 wherever the user currently lives.

## 3. Product context

PDR-003 makes the smartphone authoritative for timezone, while PDR-002 keeps
time-format preference independent. The change preserves user-authored local
time rather than silently changing content, priority, completion or history.

## 4. Engineering context

Affected boundaries:

- Prisma `User` profile metadata and additive migration;
- verified registration;
- authenticated users timezone endpoint/service;
- active recurrence templates, bounded concrete occurrences and reminders;
- mobile auth lifecycle, AppState foreground handling and React Query cache;
- NowCard, next-task preview, task form and quick-capture timezone formatting;
- regression tests for device/profile mismatch and environment-independent time.

There is no `apps/web` implementation in the repository. Web server-clock
behavior is documented by PDR-003/ADR-011 and is not falsely claimed as shipped.

## 5. Acceptance criteria

1. A new verified mobile registration with a valid IANA timezone is immediately
   marked smartphone-synchronised.
2. An authenticated mobile session synchronises its valid system IANA timezone
   on activation and each foreground return, with in-flight/no-op deduplication.
3. Invalid or unavailable device zones cause no API write and no session loss.
4. First sync of a legacy profile updates profile timezone without rewriting
   ambiguous non-recurring task timestamps; active recurrence projections may
   align to their explicit series-local anchor.
5. Later zone change atomically preserves old-zone calendar date and wall clock
   for future, unstarted, incomplete timed plan entries.
6. Active recurring templates adopt the new zone. Eligible occurrences retain
   UUID and `recurrenceDateKey`; past, started and completed rows remain exact.
7. Remote and local-only reminders are reconciled after changed timestamps.
8. NowCard, editor and timeline display the same task in profile timezone under
   a device/profile mismatch.
9. Time format remains independent and no new manual timezone setting appears.
10. API/mobile tests cover no-op, legacy adoption, Samara/GMT, New York DST,
    rollback, reminder scope, lifecycle races and query invalidation.

## 6. Out of scope

- geolocation permission;
- a manual city/timezone picker;
- multiple-phone primary-device arbitration;
- changing historical, started or completed rows;
- arbitrary recurrence rules;
- implementing a web client that is not present in this repository;
- commit, push, PR, merge, release or deployment.

## 7. Risks

- DST gaps/overlaps: use IANA conversion, never fixed-offset arithmetic.
- Partial persistence: profile and task movement must share one transaction.
- Reminder drift: reconcile exact moved IDs after commit.
- Stale mobile work after logout/account switch: guard by owner and session
  generation before every post-request state/cache/reminder effect.

## 8. Deliverables

- PDR-003 and ADR-011;
- additive Prisma migration;
- API timezone sync implementation and tests;
- mobile lifecycle sync and tests;
- profile-timezone NowCard correction and regression coverage;
- static, unit/integration and changed-file validation evidence.

## 9. Verification evidence — 2026-09-12

- Prisma Client generation and schema validation passed.
- API build passed; all 44 API suites and 673 tests passed.
- Mobile TypeScript passed; all 63 mobile suites and 682 tests passed in a
  non-UTC host timezone (`Europe/Lisbon`), covering environment independence.
- `git diff --check` passed.
- Local PostgreSQL confirmed the additive migration as finished and exposed the
  nullable `users.timezoneSyncedAt` column.
- On a physical Realme GT Neo 5 through Expo Go, the authenticated lifecycle
  changed the legacy test profile from `GMT` to `Europe/Samara` and populated
  `timezoneSyncedAt`.
- The Product Owner confirmed that the inspected task showed the same 14:45
  wall-clock time in NowCard, the editor, and the timeline.
- Actual travel/system-zone switching and recurring-task behavior across a DST
  boundary have not been physically exercised; those claims remain automated.
