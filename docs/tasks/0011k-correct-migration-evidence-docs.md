# Task 0011K: Correct User Migration Evidence Documentation

**Status:** ready for autonomous implementation  
**Source:** Product Review of Task 0011J

## Goal

Correct the Task 0011J status evidence so it describes the migration and Prisma model that actually
exist in the repository, without changing the already-correct migration or application code.

## Finding

`20260806000000_add_user_profile_plan_oauth_fields/migration.sql` adds:

- enum `Plan` (`FREE`, `PRO`);
- `hasCompletedOnboarding`;
- `plan`;
- `proExpiresAt`;
- `yandexId`, `vkId`, and `mailruId`;
- three unique provider-ID indexes.

The current Task 0011J entries in `docs/ai/IMPLEMENTATION_STATE_v2.md` and ADR-009 incorrectly claim
that it added `displayName`, `avatarUrl`, `bio`, `planExpiresAt`, `oauthProvider`, and
`oauthProviderId`. Those fields are not present in `schema.prisma` or the migration.

## Authorization

Modify only the permitted status/evidence documentation autonomously inside the repository. Do not
modify source code, Prisma schema, any migration SQL, Product Bible policy, external systems, or git
history. Do not ask for confirmation before editing project documentation.

## Requirements

- Correct the Task 0011J entry in `docs/ai/IMPLEMENTATION_STATE_v2.md` to list the actual enum,
  six fields, and three indexes.
- Correct the Task 0011J ADR-009 status-history entry to use the actual migration directory name
  `20260806000000_add_user_profile_plan_oauth_fields` (not a fictitious `.sql` filename) and the
  actual verification results.
- Add a matching Task 0011J entry to `docs/ai/NEXT_STEPS_v2.md` if the current-session history is
  intended to list every completed notification gate package.
- Preserve exact evidence from the execution report: Prisma deploy/status/diff, API e2e `3/3`, API
  tests `204/204`, and API build pass. Do not infer mobile or device results.
- Keep real-device smoke explicitly **NOT VERIFIED** and Package 0011 **NOT launch-ready** until it
  is actually run.
- Remove or correct every current-status reference to the unsupported field names; historical task
  instructions may retain them only when clearly labelled as historical input, not as completed
  evidence.

## Acceptance Criteria

- `rg -n "displayName|avatarUrl|oauthProviderId|planExpiresAt" docs/ai/IMPLEMENTATION_STATE_v2.md docs/ai/NEXT_STEPS_v2.md docs/ADR/ADR-009-device-token-and-reminder-channels.md`
  returns no unsupported Task 0011J completion claim.
- The status docs identify `hasCompletedOnboarding`, `plan`, `proExpiresAt`, `yandexId`, `vkId`, and
  `mailruId` as the migrated fields and mention enum `Plan` plus three unique indexes.
- Migration directory and evidence wording agree.
- `NOT VERIFIED` device-smoke and `NOT launch-ready` wording remain present.
- `git diff --check -- docs/ADR docs/ai` passes, excluding pre-existing CRLF warnings.
- No source/schema/migration files are changed by this task.

## Verification

```powershell
rg -n "displayName|avatarUrl|oauthProviderId|planExpiresAt" docs/ai/IMPLEMENTATION_STATE_v2.md docs/ai/NEXT_STEPS_v2.md docs/ADR/ADR-009-device-token-and-reminder-channels.md
git diff --check -- docs/ADR docs/ai
```

Finish with changed files and exact search/diff-check results. Do not claim device smoke or launch
readiness.
