# Task 0016 — User-controlled time format

## Status and user problem

Completed. A person may use one interface language and profile timezone while preferring another clock convention. Inferring clock style from either setting is surprising and risks misreading a plan. The implementation follows accepted PDR-002 and preserves the agency, clarity, and no-hidden-change rules of the Constitution and PDR-001.

## Exact model and acceptance criteria

The only values are `SYSTEM` (“Как в системе”, default), `H24` (“24-часовой”, example `14:30`) and `H12` (“12-часовой”, example `2:30 PM`). The choice is visibly selected and accessible, persists through the authenticated profile endpoint, applies consistently to clock text, and remains independent of language and timezone. Formatting must never mutate an instant or scheduling behavior.

## Persistence and API

Prisma defines `TimeFormat` and the non-null `User.timeFormat @default(SYSTEM)`. Migration `20260812010000_add_user_time_format` creates the enum and adds the column with the same default, preserving existing rows. Shared `User` exposes the field. `UpdateUserDto` permits only the canonical enum. Registration and login retain their established token-only responses. Authenticated bootstrap then loads the profile through `/auth/me`; `/auth/me`, `GET /users/me`, and `PATCH /users/me` expose `timeFormat`, so no endpoint was added. `PATCH /users/me` updates only fields explicitly sent; timezone and time format remain independent.

## Mobile behavior and changed surfaces

Settings supplies three Russian radio choices and examples, disables all choices while saving, rejects duplicate submissions, sends only `{ timeFormat }`, updates the auth-store user only from a successful response, and retains the old user with an actionable error on failure.

`lib/time-format.ts` is the deterministic presentation contract. It resolves the device hour cycle for `SYSTEM`, forces the two overrides, accepts locale and IANA timezone independently, formats internal 0–23 wall-clock fields while the Task Form exposes a 1–12 editor plus accessible AM/PM controls in 12-hour mode, and parses onboarding input without 12-hour ambiguity.

Covered app-rendered surfaces: Today quick-capture hint, action text and accessibility label; timeline hour labels; Now card scheduled/current time with its pre-Task-0016 device-timezone interpretation unchanged; task-form time display while retaining a 0–23 internal hour; Recovery overdue/destination previews and native picker preference; onboarding example, parsing, validation, and timeline explanation. Countdown durations and scheduling/conversion helpers are unchanged.

## Verification evidence

Final verification: API 14 suites / 234 tests; mobile 25 suites / 326 tests; focused API 2 suites / 14 tests; focused mobile 8 suites / 116 tests. TypeScript checks, Prisma validation/generation, and diff checks passed. Prisma schema validation and client generation passed. Migration SQL was reviewed statically but was not applied because no explicitly disposable database was provided.

## Platform limitation

The installed community native picker receives `is24Hour`. Android documents/supports this preference; native platform presentation remains ultimately controlled by the installed picker and OS, particularly on iOS. All app-rendered labels still honor the explicit preference, and stored wall-clock fields/instants remain correct. No broad picker dependency was introduced.

## Completion honesty

The persisted preference, authenticated API, Settings interaction, centralized formatter, and every currently identified app-rendered clock surface are covered. No timestamp, selected instant, day boundary, ordering, recurrence, notification, or Recovery scheduling semantics were changed.
