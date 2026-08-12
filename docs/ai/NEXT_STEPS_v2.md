# Focus — Next Steps (Based on Official TZ)

**Source:** `D:\11\Users\mihaa\Downloads\Focus_CloudCode_Master_TZ_v2\PRODUCT_FEATURE_PRIORITY.md`

---

## P0 — BEFORE LAUNCH (Release A)

### ✅ Completed

- Today dashboard ✅
- Timeline (6:00-24:00) ✅
- Day navigation (left/right arrows) ✅
- Quick Add (FAB + modal) ✅
- Inbox (unscheduled tasks) ✅
- Task CRUD ✅
- Subtasks with templates ✅
- Optimistic completion toggle ✅
- Timezone-safe dates (uses date-fns-tz) ✅
- Now / Next indicator ✅ (2026-07-31)
- Progress indicator ✅ (2026-07-31)
- Empty states (timeline/inbox/week) ✅ (2026-07-31)
- 5-minute start onboarding ✅ (2026-07-31)
- Yandex/VK/Mail OAuth ✅ (2026-07-31)
- Free/Pro architecture ✅ (2026-08-02)
- Come Back Without Guilt ✅ (2026-08-04)
- Local + Remote Notifications ✅ (2026-08-05)

---

### ❌ Blocking Launch

#### 9. 🟡 Basic Recurring Tasks (Medium Impact)

**Status:** Schema ready, expansion logic missing  
**Why P0:** Routines are core for ADHD users  
**Effort:** Medium (1-2 days)

**Patterns:**
- Daily
- Weekly (specific day)
- Weekdays (Mon-Fri)
- Skip occurrence
- Edit single occurrence

**Files:**
- `apps/api/src/tasks/tasks.service.ts` — expand RRULE instances
- `apps/mobile/app/task-form.tsx` — recurring UI

---

#### 10. 🟣 Offline Sync (Cache + Outbox)

**Status:** Not started  
**Why P0:** Accessibility, user preference  
**Effort:** Medium (1-2 days)

**Implementation:**
- Light theme (default)
- Dark theme
- System theme (follow OS)
- Auto Day/Night (switch at sunset/sunrise)
- Settings screen selector

**Files:**
- `apps/mobile/theme/colors.ts` — new
- `apps/mobile/app/(tabs)/settings.tsx` — add theme picker
- `apps/mobile/stores/theme.store.ts` — new

---

## Recommended Implementation Order

### Phase 1: Core UX ✅ COMPLETE (Week 1)
1. ✅ Now / Next indicator (4h) — DONE
2. ✅ Progress indicator (3h) — DONE
3. ✅ Empty states (2h) — DONE
4. ✅ 5-minute start (4h) — DONE

### Phase 2: Identity + Monetization ✅ COMPLETE (Week 2)
5. ✅ Yandex/VK/Mail auth (3-5 days) — DONE
6. ✅ Free/Pro architecture (2 days) — DONE

### Phase 3: Week View + Recurring (Week 3)
7. Basic week view (6-8h)
8. Basic recurring tasks (1-2 days)

### Phase 4: Notifications ✅ COMPLETE (Week 4)
9. ✅ Local + Remote push (2-3 days) — DONE (2026-08-05)
10. ✅ Come Back Without Guilt — DONE (2026-08-04)

### Phase 5: Offline + Themes (Week 5)
11. Offline sync (3-4 days)
12. Light/Dark/System themes (1-2 days)

**Total:** ~3 weeks remaining to Release A

---

## P1 — After Launch (Release B)

- Deterministic Smart Planner
- Smart Replan
- Energy-aware planning
- I'm Stuck button
- Help Me Start
- Advanced recurring patterns
- Statistics
- External calendar sync
- Theme Worlds

---

## P2 — Later (Release C/D/E)

- AI assistant (YandexGPT/GigaChat)
- AI task breakdown
- Body Doubling (Daily.co)
- Theme Builder
- macOS app
- Community features

---

## Current Session

✅ Completed (2026-08-04): **Come Back Without Guilt** — full vertical slice (backend + mobile + tests + ADR)

✅ Completed (2026-08-05): **Local + Remote Notifications** (Package 0011/0011A/0011B) — device token registry, multi-device fan-out, remote-primary with local fallback, bootstrap reconciliation, permission handling, task mutation integration. API 204/204 (11 suites), mobile 229/229 (10 suites). Redis/PostgreSQL e2e and device smoke NOT VERIFIED.

✅ Completed (2026-08-06): **Notification Lifecycle Audit** (Task 0011E) — permission revocation semantics (ADR-009 D-10), synchronous AppState transition guard (both mount and resume paths), RootLayout lifecycle test coverage (16 tests, 2 falsified regression tests). API 204/204 (11 suites), mobile 229/229 (10 suites). Package 0011 is **NOT declared launch-ready** without live infrastructure e2e and device smoke.

✅ Completed (2026-08-06): **Notification Launch Gate Verification** (Task 0011H) — attempted e2e and migration gates; device smoke NOT VERIFIED. Gate 1 (e2e): FAILED — Redis ECONNREFUSED 127.0.0.1:6379, PostgreSQL P1001 localhost:5432, 3 failed/3 total. Gate 2 (migration): FAILED — P1001 localhost:5432. Gate 3 (device smoke): NOT VERIFIED — prerequisites only checked (no adb, Docker daemon not running, no device/emulator); smoke matrix was not run. Pre-run finding: Prisma Client was stale; `prisma generate` fixed the compile error before the suite ran. Package 0011 is **NOT declared launch-ready**: gates require live Redis + PostgreSQL + a real device.

✅ Completed (2026-08-06): **E2E Gate Hardening** (Task 0011I) — `notification-reliability.e2e-spec.ts` now has a TCP preflight that probes Redis :6379 and PostgreSQL :5432 before loading any NestJS modules. Infrastructure unavailable → beforeAll throws in <2 s, Jest exits non-zero without hanging (no BullMQ retry loop). `npm run test:e2e` with services stopped: 3 failed, 6.2 s, exit 1. Live-services result: NOT VERIFIED.

✅ Completed (2026-08-06): **User Schema Migration Drift Reconciliation** (Task 0011J) — migration directory `20260806000000_add_user_profile_plan_oauth_fields` adds enum `Plan` (`FREE`, `PRO`), `hasCompletedOnboarding`, `plan`, `proExpiresAt`, `yandexId`, `vkId`, `mailruId`, and three unique indexes (`users_yandexId_key`, `users_vkId_key`, `users_mailruId_key`) — 1 enum, 6 columns, 3 indexes, additive only. `timezone` already existed and was not part of this migration. `prisma migrate deploy` → PASSED (4 migrations found). `prisma migrate status` → "Database schema is up to date!". `prisma migrate diff --from-url <DATABASE_URL> --to-schema-datamodel` → emitted only `-- This is an empty migration.`. `npm run test:e2e` → PASSED (3/3, 23.376 s, live Redis + PostgreSQL — this supersedes the NOT VERIFIED e2e status in the 0011H/0011I entries above, which were accurate when the services were down). `npm run test:api` → PASSED (204/204, 11 suites). `npm run build:api` → clean. Clean-database (from-empty) migration path **NOT VERIFIED** — only the incrementally-grown `focus_db` was validated. Real-device smoke **NOT VERIFIED**. Package 0011 remains **NOT launch-ready**.

✅ Completed (2026-08-06): **Migration Evidence Correction** (Task 0011K) — the 0011J completion report listed six `User` fields absent from `schema.prisma` and the migration SQL (`displayName`, `avatarUrl`, `bio`, `planExpiresAt`, `oauthProvider`, `oauthProviderId`). The migration and application code were correct throughout; only the written summary was fabricated. `IMPLEMENTATION_STATE_v2.md` and ADR-009 corrected against `migration.sql` as the authoritative source. No source, schema, or migration file changed.

✅ Completed (2026-08-07): **Clean-Database Migration Path Verification** (Task 0011L) — closed the 0011J from-empty gap using an **isolated disposable** container (`focus_postgres_clean_0011l`, `postgres:16-alpine`, host port **5433**, DB `focus_db_clean`, anonymous volume `6a9a7807c66c…`); shared `focus_db` never touched. `DATABASE_URL=…@localhost:5433/focus_db_clean`. Empty precheck: 0 tables. `npx prisma migrate deploy` → all **4** migrations applied in chronological order from empty (`init` → `add_device_tokens` → `notification_log_device_token` → `add_user_profile_plan_oauth_fields`). `npx prisma migrate status` → "Database schema is up to date!". `npx prisma migrate diff --from-url <CLEAN_DATABASE_URL> --to-schema-datamodel prisma/schema.prisma --script` → only `-- This is an empty migration.`. `npm run test:e2e` (clean DB :5433 + live Redis :6379) → **PASSED 3/3** (77.712 s). Isolation proof: clean-DB `xact_commit` 96→145; shared `focus_db` counts unchanged (users=3, tasks=0, device_tokens=0, notification_logs=0); `focus_postgres` container + `adhd_postgres_data` volume kept `Created=2026-07-26T12:18:59`; `focus_db` still has all 4 `_prisma_migrations`. No `db push` / `migrate reset` / `compose down -v`. **Cleanup:** `docker rm -f -v focus_postgres_clean_0011l` removed the disposable container + its anonymous volume `6a9a7807c66c…`; post-cleanup checks confirm both absent (no dangling volumes) while `focus_postgres`/`focus_redis` stay Up (healthy) and `adhd_postgres_data`/`focus_db` remain intact. `git diff --check -- docs/ADR docs/ai` clean. No source, schema, or migration SQL changed. Real-device smoke matrix remains **NOT VERIFIED** — the only open Package 0011 launch gate.

⛔ Attempted (2026-08-07): **Android Notification Device Smoke** (Task 0011M) — **NOT VERIFIED**. An emulator was available this time (AVD `Pixel_5` booted as `emulator-5554`, Android 13 / API 33, `sdk_gphone64_x86_64`; JDK 21 Android Studio JBR, Node v24.18.0, Expo CLI present), so the prior 0011H "no device" blocker is gone. But the smoke matrix could not produce trustworthy per-row runtime evidence and every row remains NOT VERIFIED. Exact blockers known at that time: (1) no push/FCM credentials — no `google-services.json` and no Expo push project in `app.json`, so D-6 remote push cannot deliver (blocks reminder-delivery, channel-policy, duplicate-delivery rows); (2) no UI-automation harness (no Maestro/Detox/Appium) to drive OS permission grant/deny/revoke/restore dialogs, Settings navigation, device reboot, and visual notification counting reproducibly; (3) app not installed. The original 0011M note also claimed `apps/mobile/node_modules` was absent; 0011N later proved that claim false. A native build still needs Metro + live API + human/device interaction. No source/tests/schema/migration/Product-Bible changed to force a pass. Package 0011 remains **NOT launch-ready** — real-device smoke is the single open gate, needing push credentials + a scripted/human-driven device session.

⛔ Resumed (2026-08-09): **Android Smoke Resume** (Task 0011N) — **NOT VERIFIED**. Corrected the false 0011M dependency claim: `apps/mobile/node_modules` and `apps/mobile/android` both exist, and `npm ls expo expo-notifications react-native --workspace=apps/mobile --depth=0` resolves the mobile workspace packages. `apps/mobile/app.json` strict JSON parse passed, and `npx expo config --type public` succeeded when Node was added to PATH. The previous `10-app-launched.png` evidence is corrupt and the prior `31-ui-after-save.xml` still shows the old Ionicons/ExpoAsset RedBox, so neither can be counted as a pass. A source-level fix removed `@expo/vector-icons` from the tab bar to eliminate the Ionicons font download path, and mobile typecheck plus Jest passed. This resumed shell still lacks usable `adb`/Docker in PATH, so no new device runtime evidence could be captured here. The Android smoke matrix remains **NOT VERIFIED** pending rerun in a shell with ADB, Docker/API, Metro, and device control available.

**Next recommended task:** Basic recurring tasks (1-2 days) — last medium-effort P0 feature before offline sync and themes
