# Task 0011G: Correct Stale Notification Verification Count

**Status:** ready for autonomous implementation  
**Source:** Product Review of Task 0011F

## Goal

Remove the remaining contradictory notification test count from the project status documentation so
all status records describe the same verified local state.

## Authorization

Edit documentation files autonomously inside the repository without asking for confirmation. Do not
modify production source code, tests, Product Bible policy, external systems, deployments, or git
history.

## User Problem

Maintainers cannot tell which notification test result is current because `NEXT_STEPS_v2.md` reports
both mobile `202/202` and mobile `229/229`. This weakens release decisions and makes a completed
verification pass appear inconsistent.

## Requirements

- In `docs/ai/NEXT_STEPS_v2.md`, update the older Package 0011/0011A/0011B status entry from mobile
  `202/202` (8 suites) to the current verified local result: mobile `229/229` (10 suites).
- Keep the later Task 0011E entry and all other current counts unchanged unless needed to remove a
  direct contradiction.
- Preserve explicit **NOT VERIFIED** wording for live Redis/PostgreSQL e2e and real-device smoke.
- Do not convert local Jest/build/typecheck/Prisma results into launch approval.
- Do not change Product Constitution, Product Vision, User Bible, Product Bible policy, or source
  code.

## Acceptance Criteria

- `rg -n "202/202|202 passed|8 suites" docs/ai docs/ADR docs/Backend.md docs/Architecture.md docs/Engineering-Handbook-v5.md`
  returns no stale Package 0011 notification status entry (historical references in task plans may
  remain only when clearly labelled as prior evidence).
- `docs/ai/NEXT_STEPS_v2.md` contains one consistent current notification result: API `204/204`
  (11 suites) and mobile `229/229` (10 suites).
- Redis/PostgreSQL e2e and real-device smoke remain explicitly **NOT VERIFIED**.
- `git diff --check -- docs/ai/NEXT_STEPS_v2.md` passes, aside from documented pre-existing
  line-ending warnings.
- Report the exact changed file and exact verification output.

## Out of Scope

- Any application behavior, tests, migrations, build configuration, or dependency changes.
- Running or provisioning Redis, PostgreSQL, Docker, Android, or iOS infrastructure.
- Rewriting historical task documents or ADR history unless a stale current-status claim remains.

## Verification

```powershell
rg -n "202/202|202 passed|8 suites" docs/ai docs/ADR docs/Backend.md docs/Architecture.md docs/Engineering-Handbook-v5.md
git diff --check -- docs/ai/NEXT_STEPS_v2.md
```

Finish with a concise changed-file summary and keep unavailable external checks explicitly **NOT
VERIFIED**.
