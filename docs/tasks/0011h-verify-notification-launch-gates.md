# Task 0011H: Verify Notification Launch Gates

**Status:** ready for autonomous implementation  
**Source:** Product Review of Notification Reliability MVP

## Goal

Close or explicitly document the two remaining launch gates for Package 0011: live
Redis/PostgreSQL end-to-end execution and real-device notification smoke testing.

## Authorization

Run verification commands and update status/evidence documentation autonomously inside the
repository without asking for confirmation. Do not modify production source code, tests, Product
Bible policy, deployments, or git history. Do not fabricate results when infrastructure or devices
are unavailable.

## Required Checks

1. Run `npm run test:e2e --workspace=apps/api` with live PostgreSQL and Redis.
2. Apply/validate Prisma migrations against the test database using the repository's documented
   migration workflow; record the exact command and result.
3. Execute the real-device smoke matrix for Android or iOS described by the notification package:
   permission grant, denial, revocation and restoration; task create/edit/toggle/delete; recovery
   reschedule; reboot; cancellation; remote/local channel selection; retry/dedup and duplicate
   delivery observation.
4. Record exact environment limitations and leave each unavailable gate explicitly **NOT VERIFIED**.

## Acceptance Criteria

- The e2e command has a recorded pass/fail result with infrastructure details; a timeout or missing
  service is not a pass.
- Migration validation/deploy result is recorded separately from unit-test results.
- At least one real Android or iOS device completes the smoke matrix, or the matrix is explicitly
  marked **NOT VERIFIED** with the missing prerequisite and reproduction command.
- Evidence states whether duplicate notifications were observed and how many deliveries occurred.
- ADR-009, `docs/ai/IMPLEMENTATION_STATE_v2.md`, `docs/ai/NEXT_STEPS_v2.md`, and relevant runbook
  documentation agree on the gate status.
- Package 0011 is called launch-ready only if both live e2e and device smoke pass; otherwise retain
  **NOT launch-ready** wording.
- No source code or Product Bible files are changed.

## Out of Scope

- Implementing new notification behavior or changing channel policy.
- Provisioning production infrastructure, publishing builds, or changing external accounts.
- Replacing device evidence with Jest mocks or static inspection.

## Verification Commands

```powershell
npm run test:e2e --workspace=apps/api
prisma migrate deploy # against the configured test database, when available
git diff --check -- docs/ADR docs/ai docs/Backend.md docs/Architecture.md docs/Engineering-Handbook-v5.md
```

Finish with a gate-by-gate evidence table and exact commands. Preserve **NOT VERIFIED** for every
gate that cannot be run in the current environment.
