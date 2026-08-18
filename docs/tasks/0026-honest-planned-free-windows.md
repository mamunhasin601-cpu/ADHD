# Task 0026 — Honest planned free windows

## Status and scope

Completed. The existing Today timeline now marks meaningful internal gaps in the
entered plan with the neutral label `Свободное окно · N мин`. This is a
presentation-only reading of existing tasks. It creates no schedule object,
availability promise, task mutation, request, cache, reminder, suggestion, or
automatic planning behavior.

Today no longer calls a day with no scheduled tasks `Свободный день` or calls an
empty timeline free. Those states now describe only the known fact: the day has
no tasks, or its tasks do not have a scheduled time.

## Geometry and uncertainty contract

`computeTimelineFreeWindows` accepts the existing `Task[]` and optional profile
timezone and returns minute and pixel geometry on the fixed 06:00–24:00 scale.
It uses `getTimelineMinutesFromStart`, so task blocks, overlap layout, the Now
Indicator, autoscroll, and free windows share one profile-local wall-clock
coordinate system. A valid IANA profile timezone wins; a missing or invalid
timezone uses device-local Date fields. UTC is never substituted silently.

The helper applies these boundaries:

- unscheduled tasks are ignored;
- completed scheduled tasks remain part of the historical displayed plan;
- only a positive stored `durationMinutes` establishes a known end;
- known intervals are clipped to 06:00–24:00 and overlapping intervals are
  merged before a gap is measured;
- only internal gaps bounded by entered scheduled tasks are candidates;
- the leading space before the first task and trailing space after the last task
  are never presented as availability;
- gaps shorter than 30 minutes are omitted as non-meaningful presentation noise;
- an unknown-duration task may provide the known right boundary of a preceding
  gap, but no end is invented for it;
- after the first unknown-duration task begins, no later free window is claimed,
  even if later known-duration tasks exist, because the unknown task may still
  overlap them;
- invalid timestamps are ignored rather than converted into another clock.

The returned `top` and `height` are derived from the same `hourHeight` as the
rest of the timeline. No time-format preference participates in geometry.

## Presentation and accessibility

Each proven window is a quiet gray timeline band with a short Russian label and
matching accessibility label. The band has no CTA and does not capture pointer
events; the timeline's existing background quick-create behavior remains
unchanged. There is no score, percentage, warning, success color, encouragement
to fill the space, or implication that a gap is rest or a buffer.

## Preserved boundaries

No database field, migration, task kind, endpoint, network request, cache,
background job, reminder behavior, analytics event, screen, route, persisted
rest/buffer block, AI behavior, energy recommendation, drag/drop, resize,
virtualization, or release was added. Task identity, recurrence, lifecycle,
timezone, exact-slot creation, task form, and notification contracts are
unchanged.

## Validation

- Focused free-window, Timeline, TaskBlock, NowIndicator, geometry, layout,
  timezone, and Today coverage: 10 suites, 154 tests passed.
- Full mobile Jest in a deterministic UTC Node process: 40 suites, 506 tests
  passed.
- Mobile TypeScript compilation and whitespace validation passed.
- The first plain Windows full-suite run used the machine's America/Chicago
  timezone and exposed an existing test-harness limitation: 3 legacy suites
  failed 9 assertions that assume setting `process.env.TZ = "UTC"` inside an
  already-running process changes Windows device-local Date fields. The same
  complete suite passed when UTC was present at Node process start; no product
  code or legacy expectations were changed to mask that limitation.
- Existing React Native Modal `act(...)` warnings remain visible in Today quick
  capture tests.

## Runtime limitations

No Android emulator or physical device was used. Android runtime remains
**NOT VERIFIED**; the evidence is Jest and static TypeScript only.
