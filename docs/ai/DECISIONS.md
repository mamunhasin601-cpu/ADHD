# Architecture Decisions Log

## 2026-07-31: Timezone-aware date filtering

**Decision:** Use `date-fns-tz` for constructing day boundaries in user's timezone when filtering tasks by date.

**Context:** Tasks are stored with UTC timestamps in PostgreSQL. When a user requests tasks for "2026-07-31", we need to interpret that date in their local timezone, not UTC.

**Implementation:**
```typescript
const dayStartUtc = toDate(`${query.date}T00:00:00`, { timeZone: userTimezone });
const dayEndUtc = toDate(`${query.date}T23:59:59.999`, { timeZone: userTimezone });
where['startTime'] = { gte: dayStartUtc, lte: dayEndUtc };
```

**Impact:**
- Correct task display across timezones
- No need for client-side timezone conversion
- Backend handles timezone logic consistently

**Status:** ✅ Implemented in `apps/api/src/tasks/tasks.service.ts`

---

## 2026-07-29: Overlapping task layout algorithm

**Decision:** Use greedy column assignment algorithm (similar to Google Calendar) for tasks that overlap in time.

**Context:** Multiple tasks can have the same start time or overlap. They need to display side-by-side, not stacked.

**Implementation:**
- New module: `apps/mobile/lib/timeline-layout.ts`
- Groups overlapping tasks into clusters
- Assigns `columnIndex` and `columnCount` to each task
- Uses percentage-based positioning (`left: '33.33%'`, `width: '33.33%'`)

**Why percentage strings, not calc():**
React Native on Android/iOS does not support CSS `calc()`. Only React Native Web does.

**Impact:**
- Overlapping tasks display correctly
- No layout shift when tasks are added/removed
- Works on all platforms (Android/iOS/Web)

**Status:** ✅ Implemented and tested

---

## 2026-07-29: Subtask presets for ADHD users

**Decision:** Provide ready-made subtask templates for common tasks to reduce decision paralysis.

**Context:** Users with ADHD often struggle with task decomposition. Pre-made templates lower activation energy.

**Current presets:**
```typescript
{
  'Уборка комнаты': ['Мусор', 'Пол', 'Поверхности'],
  'Утренняя рутина': ['Вода', 'Зарядка', 'Завтрак'],
}
```

**Future expansion:** User-requested additional presets (workout, cooking, work project).

**Status:** ✅ Implemented in `apps/mobile/app/task-form.tsx`

---

## 2026-07-29: Unscheduled tasks list

**Decision:** Show tasks without `startTime` in a separate "Inbox" section above the timeline.

**Context:** Quick-add FAB creates tasks without time by default. They were being saved but not visible (TaskBlock returned null for no startTime).

**Implementation:**
- Filter `tasks.filter(t => !t.startTime)`
- Display as compact list with colored dots
- Tap → toggle complete
- Long press → edit

**Impact:**
- All created tasks are now visible
- Clear separation between scheduled and unscheduled
- Matches ADHD workflow (capture first, schedule later)

**Status:** ✅ Implemented in `apps/mobile/app/(tabs)/today.tsx`

---

## 2026-07-29: Authentication with SecureStore

**Decision:** Use Expo SecureStore (iOS Keychain / Android Keystore) for token persistence, not AsyncStorage.

**Context:** JWT tokens should be stored securely. AsyncStorage is plain text and can be accessed by other apps on rooted/jailbroken devices.

**Implementation:**
- `apps/mobile/lib/secure-storage.ts` — wrapper around SecureStore
- `apps/mobile/stores/auth.store.ts` — calls SecureStore on login/logout
- Bootstrap on app start to restore session

**Impact:**
- Secure token storage
- Automatic session recovery
- No re-login on app restart

**Status:** ✅ Implemented and tested

---

## Technology Choices (From Original Spec)

### React Native + Expo
**Why:** Single codebase for Android/iOS, fast local dev with Expo Go, no native build required for initial development.

### Expo Router
**Why:** File-based routing, type-safe navigation, deep linking out of the box.

### NestJS + Prisma + PostgreSQL
**Why:** Type-safe backend, easy migrations, relational model fits task/user/session data well.

### Redis + BullMQ
**Why:** Reliable notification queue with retry logic. Critical for ADHD users who depend on reminders.

### React Query (TanStack Query)
**Why:** Automatic caching, optimistic updates, loading/error states out of the box.

### Zustand
**Why:** Lightweight global state for auth. Simpler than Redux for small use cases.

---

## Deferred Decisions (Future)

### Daily.co vs self-hosted WebRTC
**Status:** Not yet needed (Body Doubling is Release E)
**Trigger:** When >30% of active users use Body Doubling regularly, evaluate self-hosted option for cost savings.

### YandexGPT vs GigaChat
**Status:** Not yet needed (AI is Release D)
**Trigger:** When smart planner deterministic algorithm is complete and validated, evaluate AI provider for advanced features.

### Theme Worlds asset storage
**Status:** Not yet needed (Theme Worlds is Release C)
**Options:** CDN (VK Cloud, Selectel), self-hosted Minio, database JSONB for small assets.