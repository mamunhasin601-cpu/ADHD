# OpenCode Execution Prompt: Task 0011E

Read and execute `docs/tasks/0011e-fix-rootlayout-lifecycle-suite.md` now.

Task 0011D added the RootLayout lifecycle suite, but it currently fails three tests. Fix the
production rapid-resume race by acquiring the guard before the first await, and fix the test setup
so denied→granted and registration-failure scenarios use the current post-rerender AppState handler.
Do not weaken or delete the failing assertions.

Work autonomously inside the repository without asking for confirmation. Make actual source/test
changes, run every repository-only verification command, preserve unrelated work, and do not change
Product Bible policy. Redis/PostgreSQL e2e and real-device smoke may remain **NOT VERIFIED** when
unavailable, but that does not excuse skipping internal work.

Finish with changed files, exact results, and a truthful completion status.
