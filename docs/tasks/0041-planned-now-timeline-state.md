# Task 0041 — Planned Now Timeline State / «Сейчас по плану»

## Status

**Accepted — 2026-10-02.** Implemented on the existing feature branch on
2026-09-30; the automated evidence and the completed physical Realme acceptance
are recorded separately below. This is a new product package after the accepted
Task 0039 and does not reopen or retroactively extend Task 0039.

## 1. Product distinction

Focus now distinguishes plan from observed action:

- `Сейчас по плану` means the scheduled interval contains the shared `nowMs`,
  but the user has not confirmed that work began;
- `Выполняется` means an explicit Start produced canonical `startedAt`;
- `Не начато` means the scheduled interval ended without explicit Start.

Scheduled time never writes `startedAt`, starts elapsed time, paints diagonal
progress, launches the settling wave, completes a task, or makes it active.
There is no new persisted enum, schema field, migration, or recovery model.

## 2. Derived state model

`derivePlannedTaskStates()` computes ordinary TASK presentation with this
priority:

1. completed;
2. explicitly started / `Выполняется`;
3. `[scheduledStart, scheduledEnd)` / `Сейчас по плану`;
4. ended without Start / `Не начато`;
5. upcoming / `Запланировано`.

Known positive duration determines the exclusive end. Unknown, zero, invalid,
or negative duration ends at the next plan boundary or profile-day boundary.
Technical recurrence templates and REST/legacy BUFFER blocks are excluded;
concrete recurrence occurrences participate normally. The existing
profile-timezone calendar boundaries, H12/H24 formatter, and one
`use-minute-wall-clock` snapshot remain authoritative.

## 3. Today, NowCard, and Timeline

- The first planned-now task can occupy the rich embedded NowCard; the same task
  is not rendered as a second Timeline CTA.
- Other planned-now or missed tasks remain visible as Timeline cards and expose
  the same canonical Start flow.
- `Сейчас по плану` is stronger than upcoming and weaker than an explicitly
  started card, with a text cue rather than color alone.
- `Не начато` is neutral, retains late Start/completion/reschedule affordances,
  and enters the existing Recovery eligibility only on the next profile day.
- Started cards retain scheduled context, current time, elapsed semantics,
  diagonal fill, bounded settling wave, overdue clamp, Reduce Motion behavior,
  and TalkBack semantics.

All transitions use the Today-owned `nowMs`; TaskBlock and NowCard add no timer
and no live-region minute announcements.

## 4. One active task

If explicitly active A overlaps scheduled-current B, A remains the only
`Выполняется` task and B is `Сейчас по плану`. Starting B reuses the existing
`ACTIVE_TASK_CONFLICT` protocol and `confirmSwitch` mutation:

- `Остаться` preserves A and leaves B derived from the current interval;
- `Переключиться` makes B the sole started task, removes active focus from A,
  and never completes A or changes the completion counter.

Early Start confirmation still precedes active-task confirmation. There is no
new endpoint, optimistic-only action, or competing lifecycle.

## 5. Notifications

The scheduled-start invitation is exactly:

```text
По плану сейчас: «Название задачи»
```

The BullMQ payload remains limited to `taskId`, `userId`, and `scheduledFor`.
At delivery the worker reloads the user-owned canonical task and suppresses a
deleted, rescheduled, non-TASK, already-started, or completed task before token
fan-out. Existing deterministic job IDs, per-device delivery logs, and retry
deduplication remain the idempotency boundary.

The Expo/local delivery payload intentionally contains the task title plus
`taskId` and `scheduledFor` so a tap opens Today on the correct profile day and
focuses the intended card. Notes, user/contact/profile data, credentials, and
tokens are still excluded from content and logs. This visible-title decision
supersedes the generic delivery payload from Task 0036 and ADR-009 D-4; queue
storage remains title-free. No notification action is added because the current
Expo path has no canonical Start action protocol without new native behavior.
No preliminary reminder exists in the current pipeline, so no `Скоро: …` event
is invented.

## 6. Legacy overlaps

The API prohibition on creating conflicting scheduled intervals is unchanged.
If legacy/imported overlaps reach Timeline, every card stays visible in the
existing elastic lane layout. A connected overlap group receives one neutral
`Задачи пересекаются` label on its first card. The label is measured as card
content and included in TalkBack; it does not imply Start or create active state.
Multiple cards may be `Сейчас по плану`, but only one may be `Выполняется`.

## 7. Accessibility and preserved safeguards

TalkBack distinguishes `Запланировано`, `Сейчас по плану`, `Выполняется`,
`Не начато`, `Выполнено`, and `Задачи пересекаются` on focus. Warm/dark semantic
tokens, H12/H24, large text, elastic geometry, touch targets, Reduce Motion,
system bars, future-completion confirmation, early-Start confirmation, and the
single-active invariant remain in force.

## 8. Verification evidence

- Focused mobile state/Timeline/NowCard/Today/notification routing:
  **8 suites / 142 tests passed**.
- Focused API notification scheduling/delivery: **2 suites / 62 tests passed**.
- Full mobile Jest: **82 suites / 962 tests passed**.
- Full API Jest: **47 suites / 719 tests passed**.
- Mobile and API TypeScript checks passed; API build passed.
- Prisma schema validation passed; read-only migrate status found all 18
  migrations applied and the database schema up to date.
- Expo Android export passed. Metro emitted only the existing non-failing
  `NO_COLOR`/`FORCE_COLOR` warning; the temporary export output was removed.
- `git diff --check` passed.
- Full mobile Jest retains pre-existing non-failing React test-harness
  `act(...)` warnings around dialogs, modals, and animated sheet updates.

## 9. Physical acceptance and evidence boundary

The physical Realme smoke completed on 2026-10-02 and accepted the implemented
Task 0041 scope. It confirmed:

- `Запланировано` → `Сейчас по плану` at the scheduled minute boundary and
  `Сейчас по плану` → `Не начато` after an unstarted interval;
- planned-now does not create `startedAt`, elapsed fill, settling wave, or a
  false active state, while explicit Start creates the sole `Выполняется` state
  with elapsed, diagonal fill, and settling motion;
- background/resume immediately resynchronizes the minute-boundary state and
  preserves the explicitly running task;
- Start on a second task presents the existing `Остаться` / `Переключиться`
  conflict flow. Stay preserves the first task; Switch makes the second task the
  only running task without completing the first or changing the completion
  counter; neither path creates a duplicate CTA, a second settling wave, or two
  running cards;
- the recorded `Тест 1` / `Тест 2` scenario kept `Тест 1` as the only
  `Выполняется` task, kept `Тест 2` as `Сейчас по плану` after Stay, retained
  elapsed/wave only on `Тест 1`, and retained the `0 из 2` counter;
- maximum font/display scale remained readable and operable, and TalkBack
  distinguished `Выполняется`, `Сейчас по плану`, `Не начато`, and `Начать`.

The legacy `Задачи пересекаются` label remains automated-only evidence: its
logic, single-label grouping, elastic geometry, and TalkBack semantics are
covered by tests, but no suitable legacy overlap pair was available for a
separate device smoke.

Notification copy, canonical suppression, idempotency, and tap routing are also
covered programmatically. Real push delivery remains a separate blocked
evidence gate because working EAS `projectId`, credentials, and a device push
token are unavailable. This external gate does not block Task 0041 acceptance.

## 10. Out of scope

- Prisma/schema/migration changes;
- automatic Start or completion;
- REST Start lifecycle;
- a second Recovery or conflict protocol;
- notification provider/EAS credential changes;
- commit, push, PR, deployment, or reopening Task 0039.
