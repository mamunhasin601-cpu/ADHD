# Task 0015 — approximate task duration

## Status

Implementation is present, but completion is **blocked by environment verification**. The
required dependency install could not complete because the registry returned HTTP 403 and
the local cache did not contain `supertest`. Consequently the roadmap is intentionally not
marked complete and the full required suites/typechecks could not be claimed as passing.

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
- This task record. The Feature Roadmap is unchanged while verification is blocked.

## Verification evidence

- Focused API tests passed before dependency reinstallation: 2 suites, 32 tests.
- Pure mobile current-task and timeline-layout tests passed: 2 suites, 2 tests.
- The first focused mobile run could not resolve `@testing-library/react-native`.
- `npm ci --no-audit --no-fund` failed with HTTP 403 fetching `debug`.
- `npm ci --offline --no-audit --no-fund` failed because `supertest-6.3.4.tgz` was not cached.

## Residual limitations

No custom durations are offered by these preset-only surfaces. Migration application was not
attempted because no disposable local database was established. Full verification and the
roadmap completion marker remain pending until dependencies are available.
