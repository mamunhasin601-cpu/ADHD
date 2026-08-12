# Task 0008: Recovery Product Review Remediation

**Status:** staged execution required  
**Source:** Product Review of `0001-guilt-free-recovery.md`  
**Execution rule:** run one stage at a time and wait for acceptance before starting the next

## Goal

Correct every blocker found by the Product Review and produce evidence for the complete
Guilt-Free Recovery acceptance contract. This package does not add new product features.

## Authorization

Claude Code is authorized to create and modify files anywhere inside this repository when the
active stage requires it. Do not ask the user for permission or confirmation for repository
file creation, edits, test changes, dependency changes, or documentation updates that are
within the active stage. Preserve unrelated user changes. Do not publish, deploy, push, modify
external systems, or change Product Bible policy.

## Confirmed review blockers

1. Recovery eligibility is checked before the transaction and the write uses unconditional
   `task.update`, so a concurrent completion or reschedule can be overwritten.
2. Recovery unit tests mock the unsafe `task.update` path and do not prove conditional writes.
3. Explicit Inbox recovery has no real Inbox query or visible Inbox application surface.
4. Fixed `localDayStart + 9 hours` arithmetic is wrong on DST transition days and the mobile
   TypeScript check fails because `recoveryData` can be undefined in the callback.
5. The profile IANA timezone is not consistently used for destination display and conversion.
6. `reminderSyncStatus: "partial"` is ignored by the mobile success flow.
7. Mobile tests duplicate helper logic instead of exercising the component, hooks, and Today
   integration.
8. Controller tests are unit-level direct method tests; authenticated HTTP recovery coverage is
   missing.
9. Recovery e2e, real transaction evidence, and the manual smoke flow are not complete.
10. API, Backend, Architecture, Engineering Handbook, ADR index, and implementation-status
    documents do not match the actual evidence.

## Mandatory execution order

### Stage 1: conditional source write

Execute `0004c1-fix-recovery-transaction-write.md` through
`0008a-claude-execution-prompt.md`.

Acceptance gate: the service file must contain conditional `updateMany` writes and API build
must pass. Do not begin Stage 2 in the same run.

### Stage 2: transaction unit tests

Execute `0004c2-test-recovery-transaction.md`.

Acceptance gate: focused and complete API unit suites must pass and the tests must prove count
zero conflict behavior. Do not begin Stage 3 in the same run.

### Stage 3: real Inbox path

Execute `0005-add-recovery-inbox-path.md`.

Acceptance gate: a task moved with explicit `null` remains visible and editable in a real Inbox
surface backed by a real query. Do not begin Stage 4 in the same run.

### Stage 4: timezone and reminder UX

Execute `0006-fix-recovery-mobile-flow.md`.

Acceptance gate: no fixed-hour DST arithmetic or implicit destination remains, mobile
TypeScript passes, partial reminder status is visible, and component/hook interaction tests
pass. Do not begin Stage 5 in the same run.

### Stage 5: acceptance, integration, and documentation

Execute `0007-finalize-recovery-acceptance.md`.

Acceptance gate: authenticated HTTP/integration coverage exists, all runnable mandatory gates
pass, unsupported completion claims are removed, required engineering documents match the
implementation, and any unavailable infrastructure or manual smoke evidence is reported as not
verified.

## Completion rule

Task 0008 is complete only after all five stages have been independently executed and accepted.
Passing unit-test counts alone is not completion evidence.
