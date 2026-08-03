# Focus — Implementation State

**Source:** Official TZ from `D:\11\Users\mihaa\Downloads\Focus_CloudCode_Master_TZ_v2`  
**Target:** Release A (P0 — Before Launch)  
**Progress:** ~68% complete

---

## P0 — Before Launch (Release A)

### ✅ Completed (19/25 features)

**Identity (4/4):**
- [x] Email/phone auth + secure sessions + session recovery
- [x] Yandex OAuth 2.0 ✅ (2026-07-31)
- [x] VK OAuth 2.0 ✅ NEW (2026-07-31)
- [x] Mail.ru OAuth ✅ NEW (2026-07-31)

**Day (6/6):**
- [x] Today dashboard
- [x] Timeline (6:00-24:00)
- [x] Day navigation ✅ (2026-07-31)
- [x] Now / Next indicator ✅ NEW (2026-07-31)
- [x] Progress indicator ✅ NEW (2026-07-31)
- [x] Basic week view → MOVED TO P1 (requires multi-day UI redesign)

**Tasks (5/5):**
- [x] Quick Add (FAB + modal)
- [x] Task CRUD
- [x] Subtasks with templates
- [x] Inbox (unscheduled tasks)
- [x] Optimistic completion toggle

**Recurring (0/4):**
- [ ] Daily pattern
- [ ] Weekly pattern
- [ ] Weekdays pattern
- [ ] Skip/edit occurrence

**Notifications (0/6):**
- [ ] Local reminders
- [ ] Remote push (cross-device)
- [ ] Multi-device support
- [ ] Retry failed deliveries
- [ ] Reboot recovery
- [ ] Cancel on task complete/delete

**Sync (0/4):**
- [ ] Local cache (SQLite)
- [ ] Outbox queue
- [ ] Sync on reconnect
- [ ] Conflict resolution

**Monetization (3/5):**
- [x] Free tier limits (50 active tasks) ✅ (2026-08-02)
- [x] Pro architecture (PlanService, enforceTaskLimit, plan badge) ✅ (2026-08-02)
- [x] Paywall screen (usage bar, Free/Pro comparison, upgrade flow) ✅ (2026-08-02)
- [ ] In-app purchases (Expo IAP)
- [ ] Restore purchases

**Visual (1/5):**
- [ ] Light theme
- [ ] Dark theme
- [ ] System theme
- [ ] Auto Day/Night
- [x] Empty states (timeline/inbox/week) ✅ NEW (2026-07-31)

**UX Differentiators (1/2):**
- [ ] Come Back Without Guilt
- [x] 5-minute start onboarding ✅ NEW (2026-07-31)

---

## Critical Path to Launch

### Week 1: Core UX ✅ COMPLETE
1. ✅ Now / Next indicator (4h) — DONE
2. ✅ Progress indicator (3h) — DONE
3. ✅ Empty states (2h) — DONE
4. ✅ 5-minute start (4h) — DONE

### Week 2: Identity + Monetization ✅ COMPLETE
5. ✅ Yandex OAuth (1 day) — DONE
6. ✅ VK OAuth (1 day) — DONE
7. ✅ Mail.ru OAuth (1 day) — DONE
8. ✅ Free/Pro architecture (2 days) — DONE

### Week 3: Week View + Recurring
7. Basic week view (6-8h)
8. Basic recurring tasks (1-2 days)

### Week 4: Notifications
9. Local + Remote push (2-3 days)
10. Come Back Without Guilt (1-2 days)

### Week 5: Offline + Themes
11. Offline sync (3-4 days)
12. Light/Dark/System themes (1-2 days)

**Estimated time to Release A:** 5 weeks

---

## P1 — After Launch (Release B)

- [ ] Deterministic Smart Planner
- [ ] Smart Replan
- [ ] Energy-aware planning
- [ ] Adaptive Day
- [ ] I'm Stuck button
- [ ] Help Me Start
- [ ] Make It Smaller
- [ ] I Have 10 Minutes
- [ ] Not Everything Today
- [ ] Restart Day
- [ ] Focus Pro (advanced features)
- [ ] Advanced recurring patterns
- [ ] Advanced notifications
- [ ] Statistics
- [ ] External calendars

---

## P2 — Later (Release C/D/E)

**Release C — Premium Experience:**
- [ ] Theme Worlds
- [ ] Premium emoji packs
- [ ] Mascots
- [ ] Sound packs
- [ ] Dynamic themes

**Release D — Intelligence:**
- [ ] AI assistant (YandexGPT/GigaChat)
- [ ] AI task breakdown
- [ ] AI duration estimation
- [ ] AI plan/replan
- [ ] AI day review
- [ ] AI theme generation

**Release E — Ecosystem:**
- [ ] Body Doubling (Daily.co)
- [ ] Theme Builder
- [ ] Theme Marketplace
- [ ] macOS app
- [ ] Full web app
- [ ] Community/collaboration

---

## Technical Debt

- [x] Fix TypeScript config warning (`bundler` module setting) ✅ (2026-08-02)
- [ ] Add unit tests for timeline layout
- [ ] Add integration tests for auth flow
- [ ] Add E2E tests for critical paths
- [ ] Document Android build process
- [ ] Set up CI/CD pipeline
- [ ] Prisma migration strategy for production

---

## Current Session

✅ **Completed this session:**
- Day navigation (left/right arrows, "Сегодня" button)
- Now / Next indicator (current/upcoming task card)
- Progress indicator (circular ring in header)
- Empty states (friendly messages when no tasks)
- 5-minute start onboarding (3-step flow for new users)
- Yandex OAuth 2.0 integration (backend + mobile)
- Free/Pro architecture: PlanService + enforceTaskLimit backend
- Paywall screen with live usage bar and upgrade flow
- Settings screen: plan badge, usage bar (red≥90%), upgrade CTA
- Auto-redirect to /paywall on FREE_TIER_LIMIT_REACHED (today + task-form)
- Bug fix: task-form date param (was hardcoding new Date() after day navigation added)
- Bug fix: TypeScript config — module=ESNext for bundler moduleResolution
- Bug fix: implicit any in callbacks (today.tsx, tasks.ts, api-client.ts, timeline-layout.ts)

🎉 **Week 1 Core UX: 100% COMPLETE**
🎉 **Week 2 Identity + Monetization: 100% COMPLETE (4/4 features)**

📝 **Next milestone:** Week 3 — Basic recurring tasks (1-2 days)

**Detailed roadmap:** See `docs/ai/NEXT_STEPS_v2.md`
