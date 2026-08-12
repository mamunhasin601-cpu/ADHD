# Task 0006D: Close Recovery Test Lifecycle

**Status:** ready
**Context:** mandatory mobile test command still hangs after Task 0006C
**Next:** Task 0007 only after independent acceptance

## Goal

Make the mobile Recovery test suite terminate cleanly and without React `act(...)` warnings while
preserving the production Recovery behavior accepted through Task 0006C.

## Confirmed failure

The required command currently runs all `156/156` mobile tests successfully but does not exit. The
process remains alive beyond the 180-second command timeout and returns exit code `124`.

The hang reproduces with:

```powershell
npm.cmd run test --workspace=apps/mobile -- --runInBand --detectOpenHandles
npm.cmd run test --workspace=apps/mobile -- RecoverySection.spec.tsx --runInBand --detectOpenHandles
```

The focused suite reports all `20/20` tests passing but still does not terminate. It also emits
React warnings about RecoverySection updates not being wrapped in `act(...)`.

## Required correction

- Identify and close the actual pending QueryClient, React Testing Library, timer, or promise
  resources; do not solve this with `--forceExit` or by weakening the Jest timeout.
- Ensure every `RecoverySection` test unmounts its rendered tree and cancels/clears its dedicated
  QueryClient after the test.
- Await or flush every invalidation/refetch caused by the production mutation hook before each
  test completes.
- Wrap mutation callbacks, invalidation-driven rerenders, dismissals, and other asynchronous
  state transitions in `act(...)` or Testing Library async helpers.
- Keep the real production `RecoverySection`, hooks, QueryClientProvider, RecoveryBanner, and
  PartialReminderNotice under test. Do not replace the integration tests with direct function
  tests or mocks of the state machine.
- Preserve the existing exact timezone, DST, explicit destination, partial-success, invalid-zone,
  reset, unmount, and resubmission assertions.

## Acceptance criteria

- The full required mobile command exits with code `0` and no open-handle timeout.
- The focused `RecoverySection.spec.tsx` command exits with code `0` under `--detectOpenHandles`.
- No React `act(...)` warnings are emitted by the RecoverySection suite.
- All existing mobile tests remain green, with exact test count reported.
- No `--forceExit`, arbitrary process termination, or timeout increase is added to hide a leak.
- Production Recovery behavior is unchanged except for a narrowly justified lifecycle fix if the
  investigation proves one is necessary.

## Verification

Run and report:

```powershell
npx.cmd tsc --noEmit -p apps/mobile/tsconfig.json
npm.cmd run test --workspace=apps/mobile -- --runInBand
npm.cmd run test --workspace=apps/mobile -- RecoverySection.spec.tsx --runInBand --detectOpenHandles
npm.cmd run build:api
npm.cmd run test:api -- --runInBand
git diff --check -- apps/mobile apps/api/src/tasks packages/shared-types/src/index.ts apps/mobile/package.json apps/api/package.json package-lock.json
```

Do not claim emulator or device validation unless it was actually performed. Stop after Task
0006D; Task 0007 remains separate.

