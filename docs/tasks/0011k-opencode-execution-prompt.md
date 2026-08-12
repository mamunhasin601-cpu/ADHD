# OpenCode Execution Prompt: Task 0011K

Read and execute `docs/tasks/0011k-correct-migration-evidence-docs.md` now.

Act autonomously inside the repository. Correct only the Task 0011J status/evidence documentation:
replace the unsupported `displayName`/`avatarUrl`/`oauthProvider` field claims with the actual
`Plan` enum, `hasCompletedOnboarding`, `plan`, `proExpiresAt`, `yandexId`, `vkId`, `mailruId`, and
three unique indexes from migration `20260806000000_add_user_profile_plan_oauth_fields`. Do not
modify source code, schema, migrations, Product Bible policy, or external systems. Preserve exact
reported API e2e `3/3`, API `204/204`, build, Prisma deploy/status/diff results, and keep real-device
smoke **NOT VERIFIED** and Package 0011 **NOT launch-ready**. Finish with exact search and
`git diff --check` output; do not ask for confirmation before editing documentation.
