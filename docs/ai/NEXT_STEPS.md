# Focus — Next Steps

## Current Status Summary

**Phase:** Release A (First Good Launch) — in progress  
**Last work:** Day navigation feature — JUST COMPLETED ✅  
**Backend:** Not running (Docker Desktop not started, PostgreSQL/Redis offline)  
**Mobile:** Running on Expo Go (port 8082)  
**Git status:** Uncommitted changes + new day navigation feature

### Day Navigation — Implementation Complete

✅ Added date state to `today.tsx`  
✅ Added header with date display and left/right arrow navigation  
✅ Added "Сегодня" button (appears only when viewing past/future)  
✅ Timeline receives `shouldAutoScroll={isToday}` — auto-scrolls only for today  
✅ Timeline receives `currentDate` — creates tasks on correct day when tapping background  
✅ Task queries use `selectedDate` instead of hardcoded `new Date()`

**Testing needed:**
- Navigate to yesterday → should load yesterday's tasks
- Navigate to tomorrow → should load tomorrow's tasks (empty if none scheduled)
- Tap background on future day → should create task on that day, not today
- "Сегодня" button → should return to today
- Auto-scroll should only happen when viewing today

**Blocker:** Backend offline. Need to start Docker Desktop + `docker compose up -d` to test with real data.

---

## Immediate Priorities (Choose One)

### 🔴 Option 1: Day Navigation (High Impact, Small Effort)

**Why:** Users need to see yesterday/tomorrow, not just today. This is core functionality for a day planner.

**Effort:** 2-3 hours

**Implementation:**
1. Add date state to `today.tsx`
2. Add header with date display and left/right arrows
3. Add "Today" quick-return button
4. Optional: swipe gesture for natural navigation
5. `useTasksForDate(date)` already supports any date

**Files:**
- `apps/mobile/app/(tabs)/today.tsx`

**Testing:**
- Navigate to yesterday → see yesterday's tasks
- Navigate to tomorrow → see empty or scheduled tasks
- Tap "Today" → return to today
- Verify timezone correctness (tasks appear on correct day)

**Acceptance:**
- [ ] Can navigate to any date
- [ ] Date displays in header
- [ ] "Today" button returns to today
- [ ] Tasks load for selected date
- [ ] Timeline scrolls to current time only when viewing today

---

### 🟡 Option 2: Push Notification Device Registration (Core Feature, Medium Effort)

**Why:** P0 for Release A. Notifications are a key differentiator vs competitors.

**Effort:** 4-6 hours

**Implementation:**
1. Request notification permissions on first launch
2. Get Expo push token
3. Send token to backend (`PATCH /users/me { expoPushToken }`)
4. Backend stores token in User model
5. Test local notification
6. Test remote notification from backend
7. Add notification permission check in settings

**Files:**
- `apps/mobile/app/_layout.tsx` — already has partial code
- `apps/api/src/users/users.controller.ts` — add PATCH endpoint
- `apps/api/src/users/users.service.ts` — update user
- `apps/api/src/notifications/notifications.service.ts` — send push

**Testing:**
- Install app → permission prompt appears
- Grant permission → token sent to backend
- Create task with time → notification appears at correct time
- Complete task → notification canceled
- Delete task → notification canceled
- Test notification delivery after app restart
- Test notification delivery after device reboot

**Acceptance:**
- [ ] Permission requested on first launch
- [ ] Token saved to backend
- [ ] Local notification works
- [ ] Remote notification works
- [ ] Notification canceled when task completed/deleted
- [ ] Settings screen shows notification permission status

---

### 🟢 Option 3: Week View (User Value, Medium Effort)

**Why:** Helps users plan ahead and see weekly patterns. Frequently requested feature.

**Effort:** 6-8 hours

**Implementation:**
1. Create new tab `week.tsx`
2. 7-column horizontal scroll layout
3. Mini timeline per day (simplified, no hour labels)
4. Tap day → navigate to full day view
5. Show current day indicator
6. Load tasks for entire week in one query

**Files:**
- `apps/mobile/app/(tabs)/week.tsx` — new file
- `apps/mobile/app/(tabs)/_layout.tsx` — add tab
- `apps/mobile/lib/api/tasks.ts` — add `useTasksForWeek(startDate)`
- `apps/api/src/tasks/tasks.controller.ts` — add week query support

**Testing:**
- Switch to week tab → see 7 days
- Scroll horizontally
- Tap day → navigate to that day in today tab
- Current day highlighted
- Tasks display in correct days

**Acceptance:**
- [ ] Week view shows 7 days
- [ ] Each day shows mini timeline
- [ ] Current day highlighted
- [ ] Tapping day navigates to full view
- [ ] Scrolling is smooth

---

### 🟣 Option 4: Commit Checkpoint & Review (Process, Small Effort)

**Why:** Clean up git state before continuing. Makes it easier to track changes.

**Effort:** 1 hour

**Actions:**
1. Review uncommitted changes
2. Create meaningful commit messages
3. Consider creating feature branch
4. Push to remote
5. Update SESSION_CONTEXT.md
6. Plan next feature

**Benefit:**
- Clean slate for next feature
- Safe rollback point if needed
- Clear history for future reference

---

## Quick Wins (Low Effort, Nice to Have)

### Subtask Template Expansion (30 min)

Add more presets to `task-form.tsx`:
```typescript
'Тренировка': ['Разминка', 'Основная часть', 'Заминка'],
'Приготовить еду': ['Продукты', 'Готовка', 'Уборка'],
'Работа над проектом': ['План', 'Реализация', 'Проверка'],
'Поход в магазин': ['Список', 'Дорога', 'Покупки'],
'Подготовка к встрече': ['Материалы', 'Повторить', 'Вопросы'],
```

### Empty States (1 hour)

Add friendly messages when no tasks:
- Timeline: "День чист! Добавь первую задачу 📝"
- Unscheduled: "Нет задач без времени"

### Loading States Polish (30 min)

Add skeleton loaders instead of plain "Загрузка..."

---

## Blocked Items

### Home Screen Widget
**Blocker:** Requires native Android code (Java/Kotlin)  
**Alternatives:**
- Use EAS Build to add native modules
- Implement later as separate release
- Deprioritize for Release A

**Recommendation:** Deprioritize. Not critical for first launch.

---

## Technical Debt

### TypeScript Config Warning
**Issue:** `Option 'bundler' can only be used when 'module' is set to 'es2015' or later`  
**Impact:** Build works, but warning appears  
**Priority:** Low  
**Fix:** Update `tsconfig.json` module setting

### Port 8081 Conflict
**Issue:** Default Expo port occupied  
**Impact:** Using port 8082 instead  
**Priority:** Low  
**Fix:** Identify and stop process on 8081, or continue using 8082

---

## Recommendation

**Start with Option 1 (Day Navigation)** because:
1. High user value
2. Small effort
3. Builds on existing working code
4. No new dependencies
5. Easy to test
6. Natural stepping stone to week view later

After day navigation:
→ Option 2 (Push Notifications) for Release A completion  
→ Then Option 3 (Week View) for Release A polish

---

## Questions to Clarify

1. Should day navigation use swipe gestures or buttons? (Recommendation: both)
2. Should we commit current changes first or continue? (Recommendation: commit)
3. Any specific date range limit? (Recommendation: ±365 days from today)
4. Show week number in header? (Recommendation: yes, helps planning)