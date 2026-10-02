---
name: git-commit
description: Prepare atomic Typio commits when requested or at implementation milestones under the project commit/push policy.
---

# Git Commit

Own commit contents and messages. Do not repeat feature planning, code review, or the QA test pipeline.

1. Inspect `git status`, `git diff`, and `git diff --staged`; read relevant untracked files separately.
2. Identify one logical change and preserve unrelated work, including staged changes. Stage explicit files or hunks; do not commit unrelated staged content.
3. Apply validation proportionate to the commit: intermediate implementation milestones need focused checks, not the entire pre-merge pipeline. Disclose pending feature validation and never present an intermediate commit as merge-ready. Reuse the [QA](../qa/SKILL.md) validation record when it covers the exact content being committed. A passing dirty-working-tree run does not prove a partial staged snapshot passes. If relevant evidence is absent or stale, use QA for only the missing checks. Documentation-only changes need content/diff review, not application tests.
4. Resolve required validation failures within scope before committing; report blocked checks honestly. Do not silently broaden a commit request into implementation work.
5. Review the final staged diff, create the authorized commit, and report its hash, message, validation evidence, and remaining changes.

Do not amend, discard work, or rewrite history without authorization. Follow the standing milestone commit/push authorization and frequency in [git-branch](../git-branch/SKILL.md). Do not ask again for pushes covered by that policy. Merge authorization remains separate.

## Messages

Use `<type>(<scope>): <description>`, with a concise English imperative description starting lowercase and no trailing period. Use a stable domain scope when useful, such as `typing`, `lesson`, `keyboard`, `stats`, `auth`, `ui`, or `config`; omit it for cross-cutting changes. Avoid vague descriptions such as `update`.

Types: `feat` (feature), `fix` (bug), `refactor` (no behavior change), `perf` (performance), `style` (UI/CSS or formatting in this project), `test`, `docs`, `chore` (maintenance), `build` (build/dependencies), and `ci`.

Add a body for important reasons or tradeoffs. Mark breaking changes with `!` and a `BREAKING CHANGE:` footer explaining them.

Examples: `feat(typing): add typing speed calculation`, `fix(keyboard): handle corrected input`, `docs: explain local setup`.
