# Task 0027 — Honest user-owned rest and buffer blocks

## Status and scope

Completed. Focus now supports user-owned `REST` and `BUFFER` records as honest,
scheduled parts of the entered plan. They occupy Today timeline geometry and
bound the presentation-only free-window calculation, but they are not tasks to
start or complete.

The slice adds one compatible `TaskKind` enum (`TASK | REST | BUFFER`) and a
required Prisma column with default `TASK`. Existing stored rows and older
callers that omit `kind` therefore keep ordinary task behavior. No event kind,
recurring block, automatic planning, drag/resize, AI suggestion, energy score,
focus session, analytics, external database migration, or release is included.

## Domain and storage contract

`REST` and `BUFFER` are root records with a required `startTime` and positive,
known `durationMinutes`. They cannot have a parent, parts, first step,
recurrence, `startedAt`, or `completedAt`. Cross-field invariants are validated
before an idempotency claim is written. `createRequestId` works for blocks and
the normalized `kind` participates in the payload hash, so retrying the same
request with a different kind is a deterministic conflict.

Blocks do not consume the active-task quota. Dated task queries include them so
Today can render the full entered plan; Thoughts/inbox, incomplete queries,
reminder reconciliation ranges, and recovery are restricted to `TASK`.
Task-start, completion, parts, and recurrence commands explicitly reject
blocks. REST ↔ BUFFER edits may change title, kind, time, and duration. TASK ↔
block conversion is intentionally unavailable in this slice. Ordinary deletion
remains allowed.

Server reminder synchronization cancels any stale task-reminder job for a block
and never schedules a new one. Local scheduling and reconciliation apply the
same rule while retaining existing ownership, generation, session, and unmount
guards. Recurrence projection always persists `TASK`.

## Mobile creation and editing

The full form exposes `Задача / Отдых / Буфер`. A block requires a scheduled
time and one of the known positive duration choices. Task-only first-step,
color, recurrence, and parts controls are hidden. If a new task draft already
contains task-only data, choosing a block explains that the data must be removed
and does not discard it silently. Existing TASK ↔ block conversion controls are
disabled; REST ↔ BUFFER remains editable.

Task-owned draft data includes a first step, a selected non-default task color,
recurrence, committed parts, and text still present in the pending part input.
Any of those values prevents a new TASK draft from changing to REST/BUFFER and
all entered values remain intact. The untouched default task color does not
prevent the change.

An invalid or missing `prefillKind` normalizes to `TASK`. Global Capture retains
the quick task/Thoughts behavior and adds `Отдых` and `Буфер` entries that open
the full form without quick creation. Title, selected duration, canonical date
key, and exact timeline instant are preserved. Existing profile-timezone and
H12/H24/SYSTEM guarantees remain presentation-only; untouched Moscow and New
York instants are not rebuilt or shifted.

## Today, geometry, and accessibility

`PlanBlock` gives REST and BUFFER a quiet visual treatment distinct from
`TaskBlock`. Pressing a block opens editing and never invokes completion. Its
accessibility label states the type, title, start, end, and duration using the
existing time-format preference. A block end is known only when
`Number.isFinite(durationMinutes) && durationMinutes > 0`. A defensive legacy
block with a null, zero, negative, or otherwise invalid duration renders at the
minimum height, announces no invented end, and remains an uncertainty barrier.

Timeline overlap layout and free-window geometry receive all scheduled records,
so REST and BUFFER occupy their stored intervals. An invalid unknown-duration
block cannot create a false later free window. Progress, Now/Next selection,
notification invitation, and the unscheduled list use only normalized `TASK`
records. A day containing only REST/BUFFER remains non-empty and renders the
timeline. Recovery never moves, completes, or deletes blocks.

Current-work candidates are incomplete scheduled TASK records, but the complete
dated plan determines uncertainty boundaries. An unknown-duration TASK remains
current only until the next later scheduled plan entry starts, including REST
or BUFFER, and is no longer current at that exact boundary. Blocks are never
returned as current work; the next future TASK remains the next actionable
record. A TASK with a known positive stored duration keeps its stored end even
when a plan block overlaps it.

## Validation

- Focused API task-kind, quota, recovery, recurrence, and notification coverage
  passed 4 suites and 90 tests.
- Full API Jest passed 27 suites and 331 tests. The API production build passed
  after regenerating Prisma Client from the validated schema.
- The Task 0027 follow-up focused mobile run covered current-task, Today, task
  form, Global Capture, PlanBlock, Timeline, and free-window geometry and passed
  8 suites and 141 tests.
- Full mobile Jest with UTC present before Node startup passed 42 suites and 550
  tests. Mobile TypeScript and whitespace validation passed.
- The earlier ordinary Windows baseline completed with 3 failed and 39 passed
  suites; 9 failed and 532 passed tests, 541 total. It was not rerun for this
  follow-up because its known harness cannot redefine device-local Date fields
  after Node starts. The failing legacy suites were `components/NowCard.spec.tsx`,
  `tests/task-form.spec.tsx`, and `components/GlobalCapture.spec.tsx`.
- The known Windows timezone harness limitation remains visible: tests that
  mutate `process.env.TZ` after Node starts cannot redefine device-local Date
  fields. Deterministic full mobile evidence uses UTC present before Node starts.
- Existing React Native Modal `act(...)` warnings and npm update notices are not
  hidden.

## Runtime limitations

No Android emulator or physical device was used. Android runtime remains
**NOT VERIFIED**; Jest and static TypeScript are not runtime verification.
