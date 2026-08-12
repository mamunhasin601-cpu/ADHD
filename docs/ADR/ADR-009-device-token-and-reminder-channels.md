# ADR-009: Device Token and Reminder Channel Contract

**Status:** accepted — corrected (2026-08-05, Task 0011A)
**Packages:** Implementation Package 0011, corrected in Task 0011A

---

## Context

Package 0001 (Guilt-Free Recovery) and the product roadmap require that a user can schedule a
task and receive one privacy-safe reminder on their authenticated device. The legacy implementation
stored a single `expoPushToken` directly on the `User` model and included the task title in both
the BullMQ job payload and the push notification body. This violated privacy requirements (title
visible on the locked screen) and prevented multi-device support.

ADR-006 already chose BullMQ/Redis for delayed job scheduling and Expo Push for remote delivery.
This ADR records the device-token model and the local-vs-remote channel contract that completes
ADR-006.

Task 0011A corrected several gaps in the original 0011 implementation:
- The original D-6/D-7 incorrectly claimed that matching local and BullMQ identifiers prevent
  cross-channel duplication. They do not: local `expo-notifications` and BullMQ are different
  runtimes and namespaces; a task with both push registration and local schedule would receive two
  user-visible notifications.
- Security: `registerDeviceToken()` previously reassigned a token owned by another user silently.
- Reconciliation cancelled all OS notifications, not just Focus-owned ones.
- Permission denial looped on iOS.

---

## Decision

### D-1: Per-device token registry

Add a user-owned `DeviceToken` model instead of a single field on `User`:

```
model DeviceToken {
  id         String    @id @default(uuid())
  userId     String
  token      String    @unique
  platform   String    @default("expo")
  label      String?
  createdAt  DateTime  @default(now())
  revokedAt  DateTime?
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, revokedAt])
  @@map("device_tokens")
}
```

- A user can have multiple active (`revokedAt IS NULL`) device tokens.
- Tokens are unique; re-registering the same token for the same user is idempotent.
- Re-registering a revoked token for the same user restores it (`revokedAt = NULL`).
- Registering a token owned by another user returns 409 ConflictException; no write is performed.
  This prevents ownership-takeover attacks.
- `DeviceNotRegistered` revokes only the invalid token, not the user's other devices.
- `User.expoPushToken` is retained as a deprecated fallback during the migration period.

### D-2: Authenticated token lifecycle endpoints

```
POST   /notifications/devices    — register a push token (idempotent per user)
DELETE /notifications/devices/:id — revoke a token by record ID
```

- Both routes require JWT auth; `userId` always comes from `@CurrentUser()`.
- DTO restricts `platform` to `'expo' | 'apns' | 'fcm'`; token format enforced by `@Matches`.
  Bounded lengths prevent unbounded storage. Unknown fields rejected (`forbidNonWhitelisted`).
- Token values are never logged and never returned in responses.
- Removal is ownership-enforced: a different user's attempt returns 404 and performs no write.

### D-3: Privacy-safe job payload

`TaskReminderJobData` contains only `taskId`, `userId`, and `scheduledFor`.
`taskTitle` and all other task/user content are excluded so Redis job storage
and BullMQ retry logs never contain user-readable task data.

### D-4: Generic push payload

The Expo push body is a non-sensitive generic string ("Пора начинать") and the
`data` object contains only `{ type: 'task-reminder' }`. No task title, notes,
IDs, tokens, or user-owned content is present in the push payload or on the
locked-screen notification.

### D-5: Multi-device fan-out

`NotificationsService.sendPushNotification(userId)` queries all active
`DeviceToken` rows for the user and sends one Expo request per token.

- Per-device delivery outcome is recorded in `NotificationLog` via `deviceTokenId`.
- Retryable failures on individual devices do NOT suppress delivery to other devices.
- `DeviceNotRegistered` revokes only the affected token row; other devices continue to receive.
- `logNotification(userId, taskId, delivered, deviceTokenId?)` accepts an optional `deviceTokenId`
  for per-device dedup via `wasRecentlyDelivered(taskId, deviceTokenId?)`.

### D-6: Remote-primary channel policy (corrected in 0011A)

This installation uses a **remote-primary with local fallback** channel policy to guarantee
at most one user-visible reminder per task/start-instant per device:

| Push registration state | Local reminder policy |
|-------------------------|----------------------|
| Succeeded (push active) | Do NOT schedule local. Remote is the primary channel. |
| Failed / unavailable    | Schedule local as the only delivery channel. |

Implementation:
- `_layout.tsx` calls `setLocalOnlyMode(false)` after a successful `POST /notifications/devices`.
  On failure it calls `setLocalOnlyMode(true)`.
- `scheduleLocalReminder(task, localOnly)` is a no-op when `localOnly = false`.
- `reconcileLocalReminders(tasks, localOnly)` skips local scheduling when `localOnly = false`,
  but still cancels Focus-owned notifications on both paths (clean-slate reconcile).
- Every task mutation (`useCreateTask`, `useUpdateTask`, `useToggleTask`, `useDeleteTask`,
  `useRescheduleOverdueTasks`) reads `getLocalOnlyMode()` before scheduling.

**What this prevents:** a user with a registered push token will not receive both a server-side
remote push and a device-side local notification for the same task instant.

**Why NOT cross-runtime identifier matching:** BullMQ job IDs and `expo-notifications` scheduled
notification identifiers share a naming convention but live in different runtimes (Redis vs. the
OS notification center). A matching identifier string does not prevent two separate deliveries;
only the channel policy above does.

### D-7: Reconciliation ownership (corrected in 0011A)

- `reconcileLocalReminders()` cancels ONLY notifications whose identifier starts with
  `focus-task-reminder-`. It does NOT call `cancelAllScheduledNotificationsAsync()`, which would
  cancel unrelated calendar alerts, other app notifications, or OS system notifications.
- All Focus task-reminder local notification identifiers MUST use the prefix
  `focus-task-reminder-` (returned by `localNotificationId(taskId)`).

### D-8: Permission non-loop (corrected in 0011A)

- On each bootstrap, the app reads `canAskAgain` from `Notifications.getPermissionsAsync()`.
  If `canAskAgain === false`, the OS has recorded a permanent denial and the app skips
  `requestPermissionsAsync()` entirely. No AsyncStorage persistence is needed.
- Permission denial is a neutral, non-looping state. No local reminders are scheduled.
  Task CRUD and recovery remain unaffected.

### D-9: Notification-tap routing (added in 0011A)

- `_layout.tsx` registers a `Notifications.addNotificationResponseReceivedListener` on mount and
  removes it on unmount.
- The generic payload `{ type: 'task-reminder' }` routes taps to the Today tab
  (`router.navigate('/(tabs)')`). No task-specific deep-link is possible (no taskId in payload);
  this is intentional per ADR-009 D-4.
- Navigation failure is non-fatal and caught.

### D-10: OS notification permission revocation (added in 0011E)

- When the OS notification permission is revoked (user tapped "Don't Allow" or disabled it in
  Settings), BOTH remote push and local scheduled notifications stop working.
- `expo-notifications` returns `status: 'denied'` from `getPermissionsAsync()`, but
  `scheduleNotificationAsync()` still resolves successfully — the notification simply never
  displays. The platform provides no error or rejection to signal the silent failure.
- The correct application behavior on revocation is:
  1. Cancel all Focus-owned reminders (clean slate, no phantom entries in the OS notification
     center).
  2. Set `setLocalOnlyMode(false)` so task mutation hooks stop attempting to schedule local
     reminders that physically cannot fire.
  3. Display the `NotificationPermissionBanner` to the user. The banner is the only
     user-visible recovery path; no reminder channel works until permission is re-granted.
- `handlePermissionRevoked()` in `_layout.tsx` implements this contract (lines 246–255).
- This is distinct from D-6's local-fallback case: local fallback applies when push registration
  fails while permission is granted (local genuinely works). Permission revocation disables both
  channels, so no fallback exists.

---

## Alternatives considered

**Keep single `expoPushToken` on User**
Rejected: prevents two devices per user, makes token revocation all-or-nothing,
and cannot support per-device enabled/disabled state needed for the future.

**Put task title in push body for better UX**
Rejected: violates Product Bible privacy requirements and Package 0001 §7
("Local notification content is generic and non-sensitive; no task title on
locked device"). Generic copy is the intentional trade-off.

**Local-only channel (no remote push)**
Simpler, avoids cross-channel duplication entirely. Deferred: requires device
to be on and app to have had at least one bootstrap for reminders to exist.
Misses cross-device scenarios. Remote push is needed for full reliability.

**Identifier-matching dedup (original D-7)**
Rejected: BullMQ job IDs and OS notification identifiers are different runtimes.
Matching names do not prevent duplicate delivery. Channel policy (D-6) is the
correct mechanism.

---

## Migration / rollback

- `prisma migrate dev` (or `prisma migrate deploy` in production) applies:
  - `20260805000000_add_device_tokens/migration.sql` — adds `DeviceToken` model.
  - `20260805000001_notification_log_device_token/migration.sql` — adds `deviceTokenId`
    column to `NotificationLog`.
- `User.expoPushToken` is NOT dropped — it is retained as a nullable fallback.
  `sendPushNotification` falls back to the legacy field when no `DeviceToken` rows exist.
- Rollback: mark the migrations as reverted; the application continues using
  `expoPushToken` as before.

---

## Observability

All notification log lines conform to the contract in ADR-008:
- `outcome`, `sentCount`, `errorCount`, `totalTokens`, `latencyMs` — no user IDs,
  task IDs, titles, or token values.
- `failureClass` for provider/network errors.

---

## Known limitations

- Real-device smoke test has NOT been verified (requires emulator/device with `adb` on PATH).
- D-10's platform claim is derived from reading the `expo-notifications` API contract, NOT from
  observed device behavior. It has not been confirmed on a real device. This is the single
  assumption in this ADR that no repository-only gate can validate: `expo-notifications` is
  mocked in Jest, so a scheduled-but-never-displayed notification is unobservable to the suite.
  Device smoke is therefore load-bearing evidence here, not a formality.

---

## Status history

| Date | Status | Note |
|---|---|---|
| 2026-08-05 | accepted — implemented | Initial implementation in Package 0011. |
| 2026-08-05 | accepted — corrected | Task 0011A: remote-primary channel policy, security fix (foreign token 409), reconcile prefix-only cancel, permission non-loop, tap listener, per-device dedup, bounded bootstrap query. PostgreSQL/Redis e2e and device smoke not verified. |
| 2026-08-06 | accepted — corrected | Task 0011E: D-10 revocation semantics (cancel reminders, `setLocalOnlyMode(false)`, no phantom scheduling); synchronous AppState transition guard on both mount and resume paths; `_layout.spec.tsx` lifecycle coverage (16 tests including mount-guard and revoke-handler regression tests, both falsified). API 204/204 (11 suites), mobile 229/229 (10 suites). PostgreSQL/Redis e2e and device smoke remain NOT VERIFIED. |
| 2026-08-06 | gates attempted — NOT LAUNCH READY | Task 0011H: Attempted e2e and migration gates; device smoke NOT VERIFIED. (1) Live e2e `npm run test:e2e`: **FAILED** — Redis `ECONNREFUSED 127.0.0.1:6379`; PostgreSQL `P1001 Can't reach database server at localhost:5432`; 3 failed / 3 total; exit 1. Pre-run finding: Prisma Client was stale; regenerated via `prisma generate`. (2) Prisma migrate deploy: **FAILED** — P1001 `localhost:5432`; exit 1. (3) Real-device smoke matrix: **NOT VERIFIED** — prerequisites checked only (no `adb`, Docker daemon not running, no device/emulator); smoke matrix was not run. Package 0011 remains **NOT declared launch-ready**. |
| 2026-08-06 | e2e harness hardened | Task 0011I: TCP preflight added to `notification-reliability.e2e-spec.ts`. Probes Redis :6379 and PostgreSQL :5432 before loading any NestJS modules. Infrastructure unavailable → `beforeAll` throws in <2 s without creating BullMQ retry loops. `afterAll` null-safe via `appInitialized` flag. Observed: `npm run test:e2e` with services stopped → 3 failed, 6.2 s, exit 1, no hang, no secondary TypeError. Live-services result: NOT VERIFIED. |
| 2026-08-06 | migration deployed — e2e PASSED | Task 0011J: reconciled `User` schema drift. Migration directory `20260806000000_add_user_profile_plan_oauth_fields` adds enum `Plan` (`FREE`, `PRO`), `hasCompletedOnboarding`, `plan`, `proExpiresAt`, `yandexId`, `vkId`, `mailruId`, and three unique indexes (`users_yandexId_key`, `users_vkId_key`, `users_mailruId_key`) — 1 enum, 6 columns, 3 indexes, additive only. `timezone` already existed and was not part of this migration. `prisma generate` → Client v5.16.2 regenerated. `prisma migrate deploy` → **PASSED** (4 migrations found; new one applied). `prisma migrate status` → "Database schema is up to date!". `prisma migrate diff --from-url <DATABASE_URL> --to-schema-datamodel` → emitted only `-- This is an empty migration.`. `npm run test:e2e` → **PASSED** (3/3, 23.376 s, live Redis + PostgreSQL). `npm run test:api` → **PASSED** (204/204, 11 suites, 19.3 s). `npm run build:api` → clean. Clean-database (from-empty) migration path **NOT VERIFIED** — only the incrementally-grown `focus_db` was validated. Real-device smoke **NOT VERIFIED**. Package 0011 remains **NOT launch-ready**. |
| 2026-08-06 | evidence corrected | Task 0011K: the 0011J completion report in `IMPLEMENTATION_STATE_v2.md` and in this status history listed six `User` fields that do not exist in `schema.prisma` or the migration SQL (`displayName`, `avatarUrl`, `bio`, `planExpiresAt`, `oauthProvider`, `oauthProviderId`). The migration and application code were correct throughout; only the written summary was fabricated. Both documents corrected against `migration.sql` as the authoritative source. No source, schema, or migration file changed. Recorded command results were unaffected and are transcribed verbatim. |
| 2026-08-07 | clean-database path VERIFIED | Task 0011L: the from-empty migration path was verified against an **isolated disposable** PostgreSQL container (`focus_postgres_clean_0011l`, `postgres:16-alpine`, host port **5433**, database `focus_db_clean`, anonymous volume `6a9a7807c66c…`) — the shared `focus_db` was never touched. `DATABASE_URL=postgresql://focus_user:focus_pass@localhost:5433/focus_db_clean?schema=public`. Empty-DB precheck: 0 public tables. `npx prisma migrate deploy` → all **4** migrations applied in order (`20260727060954_init`, `20260805000000_add_device_tokens`, `20260805000001_notification_log_device_token`, `20260806000000_add_user_profile_plan_oauth_fields`). `npx prisma migrate status` → "Database schema is up to date!" (exit 0). `npx prisma migrate diff --from-url <CLEAN_DATABASE_URL> --to-schema-datamodel prisma/schema.prisma --script` → emitted only `-- This is an empty migration.` (no drift, exit 0). `npm run test:e2e` (live Redis :6379 + clean DB :5433) → **PASSED 3/3** (77.712 s). Isolation proof: clean-DB `xact_commit` 96→145 (app wrote there); shared `focus_db` counts unchanged (users=3, tasks=0, device_tokens=0, notification_logs=0 before and after); `focus_postgres` container and `adhd_postgres_data` volume retained identical `Created=2026-07-26T12:18:59` timestamps; `focus_db` still holds all 4 `_prisma_migrations` rows. No `db push`, `migrate reset`, or `compose down -v` used. No source, schema, or migration SQL changed. Real-device smoke remains **NOT VERIFIED**. |
| 2026-08-07 | disposable cleanup CONFIRMED | Task 0011L cleanup follow-up: recorded the disposal state of the 0011L test resources. Cleanup command (run at end of 0011L): `docker rm -f -v focus_postgres_clean_0011l` — removes the disposable container and, via `-v`, its anonymous volume `6a9a7807c66c…`. Post-cleanup verification: `docker ps -a --filter name=focus_postgres_clean_0011l` → **empty (container absent)**; `docker volume ls --filter name=6a9a7807c66ce7a3cba4648f8ed454825c16df5e5991cd2cd2f564f276cd4928` → **empty (anonymous volume absent)**; `docker volume ls --filter dangling=true` → **empty (no orphaned volumes)**. Shared-resource preservation: `focus_postgres` **Up (healthy)** with `Created=2026-07-26T12:18:59` and volume `adhd_postgres_data:/var/lib/postgresql/data`; `focus_redis` **Up (healthy)**; `adhd_postgres_data` volume `Created=2026-07-26T12:18:59` unchanged; `focus_db` still holds **4** `_prisma_migrations` rows and identical data (users=3, tasks=0, device_tokens=0, notification_logs=0). No broad prune/reset/`down` command used; only the explicitly-named disposable container was removed. Real-device smoke remains **NOT VERIFIED**. |
| 2026-08-07 | device smoke attempted — NOT VERIFIED | Task 0011M: an Android emulator **was** available this run — AVD `Pixel_5` booted as `emulator-5554` (Android 13, API 33, `sdk_gphone64_x86_64`, fingerprint `google/sdk_gphone64_x86_64/emu64x:13/TE1A.240213.009/12342917:userdebug/dev-keys`, `sys.boot_completed=1`), with JDK 21 (Android Studio JBR), Node v24.18.0, and Expo CLI present — so the prior 0011H "no device" blocker no longer holds. However the smoke matrix could not be executed to produce trustworthy runtime evidence and every row remains **NOT VERIFIED**. Exact blockers known at that time: (1) **no push/FCM credentials** — no `google-services.json` in repo or `android/app/` and no Expo push/FCM project in `app.json`, so the D-6 remote-primary channel cannot deliver, blocking the reminder-delivery, channel-policy, and duplicate-delivery rows; (2) **no UI-automation harness** (no Maestro/Detox/Appium) to drive OS permission grant/deny/revoke/restore dialogs, Settings navigation, device reboot, and visual notification counting reproducibly; (3) app `com.focus.adhd` not installed. The original 0011M note also claimed `apps/mobile/node_modules` was absent; 0011N later proved that claim false. A native build still yields an interactive dev client needing Metro + live API + human interaction. No source, tests, schema, migration SQL, or Product Bible policy changed to force a pass. Package 0011 remains **NOT launch-ready**; the real-device smoke matrix is the single open gate and requires push credentials plus a scripted/human-driven device session. D-10's platform claim therefore remains unconfirmed on a real device. |
| 2026-08-09 | resume audit — NOT VERIFIED | Task 0011N corrected the inaccurate 0011M dependency blocker: `apps/mobile/node_modules` and `apps/mobile/android` both exist, and `npm ls expo expo-notifications react-native --workspace=apps/mobile --depth=0` resolves the mobile workspace packages. `apps/mobile/app.json` is strict JSON and `npx expo config --type public` succeeds. The partial evidence set remains insufficient for launch: `10-app-launched.png` is corrupt (`FF FE 19 04 50 00 4E 00`, not PNG signature), `31-ui-after-save.xml` captured the old Ionicons/`ExpoAsset.downloadAsync` RedBox, and this resumed shell has no usable `adb`/Docker in PATH to reinstall/reload and prove the warning gone on-device. A source-level fix removed `@expo/vector-icons` from the tab bar so Ionicons font download is no longer required; mobile typecheck and Jest passed. The Android smoke matrix remains **NOT VERIFIED** pending rerun in a shell with ADB/Docker/Metro/API available. |
