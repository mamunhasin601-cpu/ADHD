# Task 0039 Phase B.4 — Orbits Android emulator verification

**Status:** Android emulator verification and resulting runtime corrections are
merged as of 2026-09-01. Task 0039 and full Phase B remain in progress.

## Purpose

Phase B.4 exercises the Phase B.2 Today reference screen and Phase B.3
device-local Orbits preference in an Android runtime. It records observed
behavior, corrections driven by that observation, automated validation and the
remaining evidence boundary. It does not broaden Orbits to other routes or
approve physical devices or assistive technologies.

## Environment

- Repository base after the runtime correction:
  `8a6f21540bb71e204471f6261bb44e74e7186411`.
- Pixel 7 Android emulator.
- Android 15, API 35.
- Physical resolution 1080×2400, density 420.
- System font scale `1.0`.
- Expo/Metro Android development runtime with the local Nest API, PostgreSQL and
  Redis available.

This is emulator configuration, not a physical Pixel 7 claim.

## Confirmed behavior

- `Тёплая`, `Серая` and `Тёмная` switch the production Today canvas.
- The selected theme survives Metro `reload app`.
- The gray preference survived removing Focus from Android recents and
  relaunching the application.
- The selected dark preference also survived the later workstation restart and
  runtime relaunch.
- Metro produced an Android bundle and opened Focus successfully.
- The post-fix gray Today screenshot shows a calm light-gray canvas beside the
  primary surface rather than the earlier abrupt dark-gray split.

The test account had a recurring `Android smoke — повтор` task on inspected
dates. Consequently, the post-fix emulator session could not produce a loaded
empty-day screenshot without mutating user data.

## Findings and corrections

### Misleading empty-state circle

The Today loaded-empty state passed `emoji="○"` to `EmptyState`. Android
rendered the 64-unit glyph as a black outlined circle that looked like a stuck
loading indicator across warm, gray and dark. The real query
`ActivityIndicator` remained brand-colored and was not the defect.

Today no longer passes that decorative glyph. `EmptyState.emoji` is optional
and renders no empty text node or emoji spacing when omitted. Other callers can
still supply meaningful emoji. Focused rendering coverage asserts that the
loaded empty Today state does not contain `○`.

### Gray surface split

The original gray canvas `#8B8E96` sat beside
`surfacePrimary: #F7F7F8`, producing a visually heavy boundary below the Today
header. The current gray canvas is `#E7E7EA`. Its contrast against the primary
surface is approximately 1.15:1, while gray primary and secondary canvas text
remain approximately 14.65:1 and 12.05:1 respectively.

Historical Phase A candidate previews that name `#8B8E96` remain accurate
design history and are not rewritten as current runtime values.

## Validation

At correction HEAD `da24d43c17f8f5aec9a4519384f86ab5eeb13822`:

- `npm test --workspace=apps/mobile -- --runInBand tests/today-orbits-states.spec.tsx theme/orbits.spec.tsx theme/orbits-contrast.spec.ts`
  — 3 suites passed, 17 tests passed, 0 failed.
- `npx tsc --noEmit -p apps/mobile/tsconfig.json` — passed.
- `git diff --check origin/codex/product-bible-docs..HEAD` — passed.
- Metro Android bundling and application launch — passed.
- Working tree — clean and synchronized with the source branch.
- Post-fix gray Android emulator screenshot — obtained.
- Post-fix loaded-empty Android emulator screenshot — not obtained for the
  recurring-task reason above; the focused rendering test is the available
  correction evidence.

## Scope preserved

No route, five-item Orbits navigation, fictional `План`/`Успех` destination,
API, Prisma schema, migration, package, lockfile, navigation PNG, billing,
entitlement or paid pack was changed by the runtime correction. Orbits remains
the free/default pack and Today remains the reference implementation.

## Remaining evidence gaps

Phase B.4 does **not** establish:

- physical Android or iOS device rendering approval;
- TalkBack or VoiceOver behavior;
- large-text or non-default font-scale composition;
- reduced-motion behavior;
- sound or haptic opt-out behavior;
- physical timeline-card touch-target approval;
- a post-fix loaded-empty Android emulator screenshot;
- full-app theme rollout beyond the already documented Today-oriented boundary.

These gaps keep Task 0039 and full Phase B in progress.
