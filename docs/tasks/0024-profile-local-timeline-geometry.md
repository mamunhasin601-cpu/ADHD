# Task 0024 — Profile-local timeline geometry

## Status and scope

Completed. Timeline presentation now has one wall-clock coordinate system for
task blocks, overlap intervals, the current-moment line, and initial current-time
scroll. This is a presentation-only correction: stored instants, canonical task
identity, selected date keys, capture contracts, recurrence, reminders, and
persistence are unchanged.

## Geometry contract

`getTimelineWallClock` extracts hours and minutes from an instant. A valid
profile IANA timezone is validated before it reaches `formatInTimeZone`; missing
or invalid profile timezone values explicitly use the Date's device-local fields.
There is no UTC fallback and no fixed-offset arithmetic. The shared result feeds
both minute-from-start and visible-top calculations, so TaskBlock and overlap
layout cannot silently choose different wall clocks.

The fixed visible timeline remains 06:00–24:00. Current profile wall time outside
that range produces neither a NowIndicator nor current-time scroll. H12, H24,
and SYSTEM remain label preferences only and do not participate in geometry.

## Planning-view boundary

Timeline receives `profileTimezone` explicitly and forwards it to every geometry
consumer. Today owns whether the selected profile calendar day is current. Only
that view renders NowIndicator or enables initial current-time auto-scroll; past
and future planning views do neither. Tasks on every selected day still use the
same profile-local vertical scale.

## Regression coverage

Deterministic fixtures cover Moscow and New York 14:30 instants, intentional
cross-zone coordinate differences, valid-zone precedence, device-local fallback,
DST and calendar boundaries, common TaskBlock/layout coordinates, deterministic
overlap columns, unknown-duration visual minimum without model mutation,
profile-local NowIndicator position and range hiding, planning-view suppression,
label-format invariance, and exact selected-slot instants.

## Validation

- Focused Timeline, TaskBlock, NowIndicator, layout, timezone, and Today
  integration suites passed.
- The complete mobile Jest suite and mobile TypeScript validation passed.
- Whitespace validation, changed-file inventory, full diff review, and final
  working-tree verification passed before publication.

## Runtime limitations

No Android emulator or physical device was used. Android runtime remains **NOT
VERIFIED**; evidence is deterministic Jest coverage and static TypeScript only.
