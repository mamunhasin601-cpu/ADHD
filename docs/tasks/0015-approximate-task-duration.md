# Task 0015 — approximate task duration

## Status

**Completed.** Dependency access was restored, the focused and complete verification passed,
and the roadmap now records Task 0015 as completed.

## User problem and Product Bible basis

Focus previously invented 30 minutes whenever a duration was omitted, while PDR-001 and the
Future Screen Map require approximate duration to remain user-authored and explicitly make
`Не знаю` a valid answer. This slice follows the Constitution's requirements for agency,
visible uncertainty, and no hidden plan changes.

## Domain model and acceptance behavior

`durationMinutes` is exactly `number | null`: integers 1–1440 are approximate minutes and
`null` is unknown. There is no sentinel or companion flag. New full-form and quick-capture
tasks default to `null`; the shared presets are `Не знаю`, 15, 30, 45, 60, 90, and 120
minutes. Numeric quick-capture selections reach both timed and Thoughts creation and the
full-form prefill. Failed creation retains the entered capture state; opening and successful
creation reset duration to unknown.

Known durations are displayed as `около N мин`; unknown durations are displayed as
`Длительность: Не знаю`. Timeline blocks use only the existing minimum readable block size
for unknown-duration visual layout. Current-action selection uses a known end, or for unknown
duration the next scheduled start/profile-local day end, without persisting an inference.

## Migration behavior

`20260812000000_nullable_task_duration` drops the database default and `NOT NULL` constraint
in place. It neither rebuilds the table nor updates rows, so every existing numeric value,
including 30, is preserved.

## Changed files

- Prisma schema and forward migration.
- Task create DTO, service, service/validation tests, and shared task types.
- Mobile task form, Today capture/current selection, NowCard, TaskBlock, timeline layout,
  shared duration presets, and focused tests for these behaviors.
- This task record and the Feature Roadmap completion marker.

## Verification evidence

- `npm ci --no-audit --no-fund`: passed; 1,744 packages installed from the committed lockfile.
- Prisma schema validation and client generation: passed. Validation used a syntactically
  valid local-only placeholder `DATABASE_URL`; it did not connect to a database.
- Focused API tests: 2 suites, 32 tests passed.
- Focused mobile tests: 5 suites, 23 tests passed.
- Complete API tests: 12 suites, 220 tests passed.
- Complete mobile tests: 22 suites, 280 tests passed.
- API and mobile `tsc --noEmit`: passed.
- Both required `git diff --check` commands: passed.

## Residual limitations

No custom durations are offered by these preset-only surfaces. Migration application was not
attempted because no disposable local PostgreSQL installation or database was available; the
schema and forward SQL were validated/inspected without contacting a database. The mobile
suite emits an existing React Native Modal `act(...)` cleanup warning while passing.
