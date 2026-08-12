# Task 0005B: Add Real Inbox Boundary Tests

**Status:** ready  
**Context:** final test correction for Task 0005A  
**Next:** Task 0006 after acceptance

## Goal

Replace the remaining simulated Inbox coverage with tests that exercise the real NestJS HTTP
pipeline and the real Inbox screen. Keep the working Inbox implementation and cache behavior
unchanged unless a real boundary test exposes a defect.

## Current state

The Inbox route, screen, and `useToggleInboxTask` behavior are implemented. API tests, API build,
mobile tests, mobile TypeScript, and scoped diff checks pass.

Two evidence gaps remain:

1. `tasks.controller.inbox.spec.ts` calls `controller.findAll()` directly with an already-built
   object. It does not prove query-string conversion, the configured `ValidationPipe`, route
   behavior, or the request identity boundary.
2. `inbox.spec.ts` exercises production hooks, but no test renders `InboxScreen` or verifies its
   loading, empty, populated, retry, navigation, and long-press interactions.

## Backend HTTP test requirements

Create an actual Nest test application and send HTTP requests through the route using the
project's real global validation configuration. Mock external/service boundaries as needed, but
do not call controller methods directly for these cases.

Prove:

- `GET /tasks?inbox=true` converts the query-string value and delegates to `TasksService.findAll`
  with the authenticated request user's ID and `inbox: true`;
- `includeSubTasks=true` is converted correctly;
- invalid boolean values are rejected rather than treated as truthy;
- a caller-supplied `userId` query parameter is rejected by whitelist validation and cannot
  replace authenticated identity;
- the HTTP response status and body preserve the route contract;
- service errors propagate through the normal Nest exception layer.

Use an overridden test guard or equivalent request-user fixture so the test still exercises
`@CurrentUser()` without requiring a real external login. Add a narrowly scoped test dependency
such as `supertest` only if the workspace does not already provide an equivalent tool.

If real HTTP tests reveal that boolean query conversion accepts invalid strings, fix the DTO
with explicit, tested conversion. Preserve existing clients that send `true` and `false`.

## Inbox screen test requirements

Render the real `InboxScreen` component with mocked router and production hooks. Verify:

- loading state;
- empty state;
- populated task state;
- error state and retry interaction;
- pressing a task opens the existing task form with that task;
- long-press calls the real Inbox toggle hook rather than a dated toggle hook;
- completed and incomplete visual/accessibility state where practical.

Use the existing Jest/Expo setup. Add the smallest suitable React Native testing dependency only
if necessary. Remove or rename claims that a test is HTTP/component-level when it is only a
direct function test. Preserve the useful production-hook tests already present.

## Constraints

- Do not redesign Inbox or recovery behavior.
- Do not begin Task 0006.
- Preserve unrelated user changes.
- Do not modify Product Bible policy or external systems.

## Verification

Run and report:

```powershell
npm.cmd run build:api
npm.cmd run test:api -- --runInBand
npx.cmd tsc --noEmit -p apps/mobile/tsconfig.json
npm.cmd run test --workspace=apps/mobile -- --runInBand
git diff --check -- apps/api/src/tasks apps/mobile/app apps/mobile/lib apps/mobile/components apps/api/package.json apps/mobile/package.json
```

Fix in-scope failures before finishing. Report exact test counts and distinguish real HTTP,
component, hook, and unit tests accurately.
