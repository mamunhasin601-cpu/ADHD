# Focus — Next Steps (Based on Official TZ)

**Source:** `D:\11\Users\mihaa\Downloads\Focus_CloudCode_Master_TZ_v2\PRODUCT_FEATURE_PRIORITY.md`

---

## P0 — BEFORE LAUNCH (Release A)

### ✅ Completed

- Today dashboard
- Timeline (6:00-24:00)
- Day navigation (left/right arrows)
- Quick Add (FAB + modal)
- Inbox (unscheduled tasks)
- Task CRUD
- Subtasks with templates
- Optimistic completion toggle
- Timezone-safe dates (uses date-fns-tz)

---

### ❌ Blocking Launch

#### 1. 🔴 Yandex/VK/Mail Auth (CRITICAL)

**Status:** Currently only email/phone  
**Why P0:** Identity requirement for Russian market  
**Effort:** Large (3-5 days)  
**Risk:** High (OAuth integrations, account linking)

**Implementation:**
1. Backend: Add OAuth strategies (Passport.js)
   - Yandex OAuth 2.0
   - VK OAuth 2.0
   - Mail.ru OAuth
2. Mobile: Add OAuth flow screens
3. Account linking (one user, multiple providers)
4. Migrate existing email/phone users

**Files:**
- `apps/api/src/auth/strategies/yandex.strategy.ts` — new
- `apps/api/src/auth/strategies/vk.strategy.ts` — new
- `apps/api/src/auth/strategies/mail.strategy.ts` — new
- `apps/mobile/app/login.tsx` — add OAuth buttons
- `apps/mobile/lib/api/auth.ts` — add OAuth endpoints

---

#### 2. 🟡 Now / Next Indicator (High Impact)

**Status:** Not started  
**Why P0:** Core UX — "where am I in my day?"  
**Effort:** Small (4-6 hours)

**Implementation:**
- Highlight current task on timeline
- Show "Next up" card at top of screen
- Auto-update every minute

**Files:**
- `apps/mobile/app/(tabs)/today.tsx` — add Now/Next section
- `apps/mobile/components/timeline/NowIndicator.tsx` — already exists, enhance

---

#### 3. 🟢 Progress Indicator (Medium Impact)

**Status:** Not started  
**Why P0:** Visual feedback on day completion  
**Effort:** Small (3-4 hours)

**Implementation:**
- Circular progress ring in header
- Show completed / total tasks
- Animate on task completion

**Files:**
- `apps/mobile/app/(tabs)/today.tsx` — add progress component
- `apps/mobile/components/ProgressRing.tsx` — new

---

#### 4. 🟢 Basic Week View (Medium Impact)

**Status:** Not started  
**Why P0:** Plan ahead, see patterns  
**Effort:** Medium (6-8 hours)

**Implementation:**
- New tab "Week"
- 7-column horizontal scroll
- Mini timeline per day
- Tap day → full view

**Files:**
- `apps/mobile/app/(tabs)/week.tsx` — new
- `apps/mobile/app/(tabs)/_layout.tsx` — add tab

---

#### 5. 🟣 Empty States (Polish)

**Status:** Not started  
**Why P0:** Avoid confusion, guide new users  
**Effort:** Tiny (2 hours)

**Messages:**
- Timeline empty: "День чист! Добавь первую задачу 📝"
- Inbox empty: "Нет задач без времени"
- Week empty: "Неделя пуста — добавь планы"

**Files:**
- `apps/mobile/app/(tabs)/today.tsx`
- `apps/mobile/app/(tabs)/week.tsx`

---

#### 6. 🔴 Come Back Without Guilt (Core UX)

**Status:** Not started  
**Why P0:** Product differentiator, ADHD-friendly  
**Effort:** Medium (1-2 days)

**Implementation:**
- Detect overdue tasks
- Show gentle message: "Вчера не получилось? Ничего страшного. Перенести на сегодня?"
- Bulk reschedule UI
- No shame language

**Files:**
- `apps/mobile/app/(tabs)/today.tsx` — add recovery banner
- `apps/api/src/tasks/tasks.service.ts` — add bulk reschedule endpoint

---

#### 7. 🟢 5-Minute Start (Onboarding)

**Status:** Not started  
**Why P0:** Reduce activation energy  
**Effort:** Small (4 hours)

**Implementation:**
- First-time user flow
- Pre-fill 3 sample tasks
- Quick tutorial (3 screens max)
- Skip button always visible

**Files:**
- `apps/mobile/app/onboarding.tsx` — new
- `apps/mobile/app/index.tsx` — check if first launch

---

#### 8. 🔴 Local + Remote Notifications (CRITICAL)

**Status:** Partially implemented (queue exists, delivery missing)  
**Why P0:** Core product value  
**Effort:** Large (2-3 days)

**Implementation:**
1. Request notification permissions
2. Register Expo push token with backend
3. Schedule local notifications
4. Send remote push from backend (BullMQ queue)
5. Retry failed deliveries
6. Reboot recovery (re-schedule on device restart)
7. Cancel on task complete/delete

**Files:**
- `apps/mobile/app/_layout.tsx` — register push token
- `apps/api/src/users/users.controller.ts` — PATCH /users/me endpoint
- `apps/api/src/notifications/notifications.service.ts` — send push

---

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
**Why P0:** Mobile users expect offline work  
**Effort:** Large (3-4 days)

**Implementation:**
- Local SQLite cache (react-query persistence)
- Outbox queue for offline mutations
- Sync on reconnect
- Conflict resolution (server wins)

**Files:**
- `apps/mobile/lib/offline-storage.ts` — new
- `apps/mobile/lib/api-client.ts` — add outbox logic

---

#### 11. 🔴 Free/Pro Monetization (Business Critical)

**Status:** Not started  
**Why P0:** Business model  
**Effort:** Medium (2 days)

**Implementation:**
1. Backend: add `subscriptionTier` to User model
2. Backend: entitlement check middleware
3. Mobile: paywall screen
4. Mobile: in-app purchase (Expo In-App Purchases)
5. Mobile: restore purchases

**Free tier limits:**
- 50 tasks/month
- 1 recurring routine
- Basic theme only

**Pro features:**
- Unlimited tasks
- Unlimited routines
- All themes
- Smart Planner (Release B)
- Body Doubling (Release E)

**Files:**
- `apps/api/src/users/user.entity.ts` — add subscriptionTier
- `apps/api/src/auth/guards/pro.guard.ts` — new
- `apps/mobile/app/paywall.tsx` — new
- `apps/mobile/lib/iap.ts` — new

---

#### 12. 🟢 Themes (Light/Dark/System/Auto)

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

### Phase 1: Core UX (Week 1)
1. Now / Next indicator (4h)
2. Progress indicator (3h)
3. Empty states (2h)
4. 5-minute start (4h)

### Phase 2: Identity + Monetization (Week 2)
5. Yandex/VK/Mail auth (3-5 days)
6. Free/Pro architecture (2 days)

### Phase 3: Week View + Recurring (Week 3)
7. Basic week view (6-8h)
8. Basic recurring tasks (1-2 days)

### Phase 4: Notifications (Week 4)
9. Local + Remote push (2-3 days)
10. Come Back Without Guilt (1-2 days)

### Phase 5: Offline + Themes (Week 5)
11. Offline sync (3-4 days)
12. Light/Dark/System themes (1-2 days)

**Total:** ~5 weeks to Release A

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

✅ Completed today: **Day navigation** (left/right arrows, "Сегодня" button)

**Next recommended task:** Now / Next indicator (small, high impact)
