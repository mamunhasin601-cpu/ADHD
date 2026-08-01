# Testing Day Navigation Feature

## What Was Implemented

Day navigation allows users to view tasks for any day (yesterday, today, tomorrow, or any date).

### Changes Made

**Mobile App (`apps/mobile/app/(tabs)/today.tsx`):**
- Added `selectedDate` state (starts with today)
- Added date navigation UI:
  - Left arrow (‹) → previous day
  - Right arrow (›) → next day
  - Date label in center (e.g., "среда, 31 июля")
  - "Сегодня" button (only visible when viewing past/future)
- All queries now use `selectedDate` instead of hardcoded today
- Timeline auto-scrolls to current time ONLY when viewing today

**Timeline Component (`apps/mobile/components/timeline/Timeline.tsx`):**
- Added `shouldAutoScroll` prop (default: true)
- Added `currentDate` prop (default: new Date())
- `handleBackgroundPress` now creates tasks on `currentDate`, not always today

---

## How to Test

### Prerequisites

1. **Start Docker Desktop** (required for PostgreSQL + Redis)
2. **Start backend:**
   ```powershell
   cd apps/api
   npm run start:dev
   ```
3. **Mobile app should already be running** on port 8082

### Test Cases

#### 1. Navigate to Yesterday
- Open app → tap left arrow (‹)
- **Expected:** Date changes to yesterday, tasks from yesterday load (if any exist)
- **Expected:** "Сегодня" button appears in top-right
- **Expected:** Timeline does NOT auto-scroll to current time

#### 2. Navigate to Tomorrow
- From today, tap right arrow (›)
- **Expected:** Date changes to tomorrow
- **Expected:** Empty timeline (unless tasks scheduled for tomorrow)
- **Expected:** "Сегодня" button appears

#### 3. Return to Today
- From yesterday or tomorrow, tap "Сегодня" button
- **Expected:** Returns to today's date
- **Expected:** Timeline auto-scrolls to current time
- **Expected:** "Сегодня" button disappears

#### 4. Create Task on Future Day
- Navigate to tomorrow (›)
- Tap on timeline background at e.g. 10:00
- Enter task name → "Создать"
- **Expected:** Task appears on tomorrow's timeline
- Navigate back to today ("Сегодня")
- **Expected:** New task does NOT appear on today
- Navigate to tomorrow again
- **Expected:** Task is still there

#### 5. Create Unscheduled Task on Past Day
- Navigate to yesterday
- Tap FAB (+) → enter task name → "Создать"
- **Expected:** Task appears in "Без времени" section
- **Expected:** Backend saves task with yesterday's date metadata (not today)

#### 6. Week Navigation
- Tap left arrow multiple times
- **Expected:** Can navigate 7+ days into the past
- Tap right arrow multiple times from today
- **Expected:** Can navigate into future (no hard limit)

---

## Known Issues / Limitations

### Current Implementation
- No swipe gesture (only arrow buttons)
- No week picker / calendar UI
- No visual indicator for "days with tasks" when navigating
- No limit on date range (can navigate to year 2050 or 1990)

### Future Enhancements (Not in Scope)
- Swipe left/right to change days
- Mini calendar picker
- Week dots indicator (like iOS Calendar)
- Prefetch adjacent days for smooth navigation

---

## Files Modified

```
modified:   apps/mobile/app/(tabs)/today.tsx
modified:   apps/mobile/components/timeline/Timeline.tsx
```

---

## What to Check in Backend Logs

When navigating days, you should see backend queries like:
```
GET /tasks?date=2026-07-30&includeSubTasks=true  (yesterday)
GET /tasks?date=2026-07-31&includeSubTasks=true  (today)
GET /tasks?date=2026-08-01&includeSubTasks=true  (tomorrow)
```

Each date change triggers a new API call with correct date parameter.

---

## Backend Requirements

**Already implemented (no backend changes needed):**
- `GET /tasks?date=YYYY-MM-DD` filters tasks by user's timezone
- Uses `date-fns-tz` to handle timezone correctly
- Returns tasks with `startTime` in that calendar day

The backend already supports any date — no changes needed there.

---

## Next Steps After Testing

1. If tests pass → commit changes:
   ```powershell
   git add apps/mobile/app/(tabs)/today.tsx
   git add apps/mobile/components/timeline/Timeline.tsx
   git commit -m "feat: add day navigation with left/right arrows"
   ```

2. Update SESSION_CONTEXT.md:
   - Move "Day navigation" from "High Priority Gaps" to "What works"

3. Choose next priority:
   - Push notifications (P0 for launch)
   - Week view (user value)
   - Empty states (polish)

---

## Rollback Instructions

If navigation breaks something:
```powershell
git checkout apps/mobile/app/(tabs)/today.tsx
git checkout apps/mobile/components/timeline/Timeline.tsx
```

Or restore from this session's start point (before day navigation changes).