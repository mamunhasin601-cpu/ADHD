# Task 0039 Phase B.5 — Orbits product decisions and physical-device evidence

**Status:** planning record; implementation and verification remain explicitly separated  
**Branch:** `codex/verify-orbits-phase-b5-android-accessibility`  
**Code checkpoint:** `7ba66b2a64c982c977fd872adda4f8c38b5de6a8`  
**Recorded:** 2026-09-02

## Purpose

This note preserves the product decisions made during Phase B.5 physical-device review. It is not an acceptance report for unfinished features. Sections below distinguish:

1. decisions that define the intended product structure;
2. evidence actually observed on a physical Android device;
3. hypotheses and future scope that have not been implemented or approved.

## Accepted product decisions

### Five-destination Orbits navigation

The persistent bottom navigation is:

1. **Сегодня** — immediate work, the current and next task, and the day timeline;
2. **План** — planning inputs and future organization;
3. **Добавить** — global capture;
4. **Успех** — completed work, progress, and supportive reflection;
5. **Профиль** — account, preferences, notification state, permissions help, and other settings.

The center Add action remains an action rather than a destination. The five labels and their order are stable for this phase.

### Today

Today must prioritize the user's actionable day rather than consume the first viewport with orientation copy.

Accepted direction:

- keep the greeting, date, week selector, date navigation, progress ring, and **Ваш день**;
- remove the motivational sentence below the date;
- reduce vertical spacing so current work appears earlier;
- preserve date navigation and truthful progress;
- keep the body scrollable;
- keep the current task, an immediately visible next-task preview, and the timeline reachable;
- avoid floating controls obscuring task actions;
- support increased font sizes without clipping or hiding actions.

The compact header is an accepted change but is not implemented by this planning-only commit.

### Plan

Plan is the home for organizing work beyond the immediate Today view. Its intended sections are:

- **Мысли** — a prominent entry to the existing inbox, with a truthful count and loading/error/empty states;
- **Ближайшее** — upcoming tasks and days;
- **Рутины** — recurring work;
- **Составить план с AI** — an explicit, user-initiated planning assistant.

The existing inbox data must not be duplicated or replaced. Plan should provide access to the existing source of truth.

### AI planning

AI planning is an accepted product direction, not an implemented feature.

Required behavior:

- AI produces an explainable draft, never a silent plan mutation;
- the user reviews, edits, removes, and explicitly confirms suggestions;
- existing tasks are not overwritten;
- every committed change supports recovery or undo where applicable;
- the UI identifies which permitted signals informed the draft;
- private note content and history are not sent to a model without explicit consent;
- history use can be disabled;
- insufficient history is stated honestly;
- an initial version may use only current thoughts, deadlines, estimated duration, routines, and available time;
- adding or selecting an AI provider requires separate scope and approval.

Potential future signals include actual start/completion times, realistic duration, reschedules, recovered work, productive time windows, routines, and prior workload. These remain hypotheses until a data audit confirms that each metric is available, reliable, and appropriate to use.

### Success

Success is the supportive record of progress. It is distinct from AI planning:

- **Успех** explains past progress to the user;
- AI in **План** may use only the explicitly permitted, reliable subset of that history to propose future work.

Candidate Success content:

- completed tasks by day, week, and month;
- completed focus sessions and honest focus duration;
- completed routines;
- gentle streaks;
- tasks returned to after a reschedule;
- small achievements such as starting a difficult task, completing a first step, or clearing Thoughts;
- personal patterns that are supported by enough data.

Success must avoid blame, red failure framing, or treating imperfect consistency as failure. Recovery and returning to a task are meaningful progress. Candidate metrics require a separate data-source audit and are not yet promised by the current preview screen.

### Themes

Warm and dark are the supported themes for this direction. The gray theme was rejected during physical-device review because it did not provide a useful, appealing alternative. A previously stored gray preference should safely fall back to warm.

### Notification permissions and phone help

Notification status must reflect the actual platform permission, not only a local preference.

The Profile notification section should:

- re-check permission when the screen opens and when the app returns from the background;
- distinguish `not-asked`, `granted`, and `denied`;
- show **Включить уведомления** before the first request;
- show **Уведомления выключены** and a prominent **Открыть настройки телефона** action after denial;
- re-check status after returning from system settings;
- explain required Android settings in a small in-app help section;
- cover notifications, background execution, battery restrictions, autostart where applicable, exact alarms where applicable, sound/vibration, network access, and automatic date/time/timezone;
- provide device-family guidance without claiming that every OEM exposes identical settings.

The app must not open system settings without a user action. Runtime auditing is still required for battery optimization, background restrictions, exact alarms, and OEM-specific Realme behavior.

## Physical Android evidence

Observed on a physical **Realme GT Neo 5**, software reported as **RMX3706_16.0.3.503**, using the SDK 51-compatible Expo Go build.

Confirmed by direct user observation:

- the Orbits bottom navigation is visible and its visual direction was positively accepted;
- a task can be created;
- Today scrolls;
- the task and subsequent timeline are reachable through scrolling;
- moving a task to Thoughts succeeds;
- the recovery notice appears with calm copy;
- undoing that move succeeds;
- warm/light and dark are the preferred themes;
- the gray theme is not accepted;
- the Today header occupies too much of the first viewport and needs compaction.

The phone's font settings screenshot reported **Обычный** (normal). The earlier Today clipping and reachability problem therefore was not limited to large-text mode.

Development connectivity evidence:

- the phone and computer were on the same LAN;
- the phone could reach `http://192.168.1.84:3000` and received the expected 404 for an undefined root route;
- the physical-device API URL needed the computer LAN address rather than Android-emulator alias `10.0.2.2`.

## Not yet verified or approved

This record does not claim completion of:

- compact Today header runtime verification;
- Thoughts entry inside Plan;
- real Upcoming, Routines, or AI Plan content;
- real Success metrics or achievements;
- AI data-source, consent, privacy, provider, cost, or quality design;
- TalkBack focus order and announcements;
- VoiceOver verification;
- large-text matrix at 1.3 and maximum practical scale;
- runtime touch-target approval;
- reduced-motion behavior;
- sound or haptic opt-out;
- notification permission re-check after resume;
- Android battery/background/exact-alarm flows;
- OEM-specific Realme settings deep links;
- production-build behavior outside Expo Go.

Plan and Success may remain honest preview screens until their separately scoped data and interaction work is implemented.

## Next bounded work

Before broadening scope, the next implementation should remain small:

1. compact the Today header while preserving accessibility and date controls;
2. expose the existing Thoughts inbox from Plan with truthful state handling;
3. run focused Jest and TypeScript checks;
4. produce a Metro Android bundle;
5. repeat physical-device verification on the Realme device at normal and increased font sizes.

Notification permissions, real Plan aggregation, Success metrics, and AI planning should each receive a separate read-only audit and explicit implementation approval.
