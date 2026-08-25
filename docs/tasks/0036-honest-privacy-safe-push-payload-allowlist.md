# Task 0036 — Honest privacy-safe Expo push payload allowlist

## Root cause and decision

The Expo request was already generic, but its privacy boundary lived inline in
`NotificationsService._sendToToken()`. Existing tests rejected a few selected
fields without proving that the serialized request had an exact shape. A future
field could therefore forward task or user content without failing validation.

Task 0036 introduces one typed construction path:

```json
{
  "to": "<device token>",
  "title": "Focus",
  "body": "Пора начинать",
  "sound": "default",
  "data": {
    "type": "task-reminder"
  }
}
```

The builder accepts only the device token needed as Expo's delivery address. It
does not accept task, user, profile, or arbitrary metadata objects. Runtime
tests parse the actual serialized HTTP body and assert the complete object and
key sets, including generic title/body and `data.type`.

## Queue and external boundaries

The internal BullMQ job remains compact and contains only `taskId`, `userId`,
and `scheduledFor`. Those IDs remain in Redis for lookup, deduplication, and
scheduling, but they are not forwarded to Expo. The external request contains
only the allowlisted payload above. Device tokens are used only in the request
body as delivery addresses; they are not logged, returned in delivery results,
written to queue payloads, or included in error mappings or documentation
examples.

## Preserved behavior

Task 0036 does not change multi-device fan-out, per-device deduplication,
legacy `expoPushToken` delivery, `DeviceNotRegistered` revocation, BullMQ retry
ownership, `retry: "none"` per Expo operation, the fixed HTTPS endpoint, generic
wording, notification-log persistence, or safe transport failure classes.
Known `ExternalHttpError` failures continue to avoid duplicate unsafe logs.

No task title, notes, IDs, contact details, verification PIN/ticket, OAuth data,
tokens, profile fields, calendar/timezone details, scheduled time, labels,
arbitrary metadata, provider body, causes, or stacks enter the external Expo
payload or logs.

## Russian infrastructure boundary

Expo remains an unresolved foreign-service exception under
[`ADR-010`](../ADR/ADR-010-russian-production-infrastructure-and-data-residency.md).
This task does not classify Expo as Russian infrastructure, select a Russian
push provider, or resolve the production data-residency decision. A later task
must decide whether to replace Expo or formally resolve that exception before
claiming Russian-only production infrastructure.

## Validation and evidence

Automated validation covers exact serialized payloads, top-level and nested
allowlist keys, token-only variation, sensitive fixture exclusion, multi-device
fan-out, legacy delivery, `DeviceNotRegistered`, per-device deduplication, safe
transport outcomes/logging, and the three-field BullMQ job contract.

Runtime evidence remains **NOT VERIFIED** for live Expo delivery, production
API, PostgreSQL/Redis runtime, Timeweb Cloud placement, Android emulator,
physical devices, a Russian push-provider replacement, and full 152-FZ evidence.
Automated tests and builds are validation, not runtime evidence.

### Automated results

- Focused notification tests: 3 suites / 69 tests passed.
- Full API test suite: 40 suites / 569 tests passed.
- API TypeScript validation, API production build, and `git diff --check` passed.
- Prisma schema, migrations, `.env`, and database data were unchanged.
- Prisma Client generation was intentionally not run; the verified Task 0034
  Prisma Client v5.16.2 result remains authoritative.
