---
name: git-branch
description: Create or select Typio task branches and perform authorized merges, publishing, or branch cleanup.
---

# Git Branch

Own branch strategy and merge authorization. Do not run a separate validation pipeline.

## Strategy

- `main` is stable; `develop` is the permanent integration branch.
- Start one short-lived branch per feature from verified `develop`, unless the user specifies another base. Reuse a branch already serving the task.
- Name branches `<type>/<short-english-description>` in lowercase with hyphens, for example `feat/typing-speed`. Types follow [git-commit](../git-commit/SKILL.md). Honor explicit user names; do not invent issue identifiers.
- Squash feature branches into `develop` using a Conventional Commits message. Use regular merges from `develop` into `main` to preserve ancestry. Synchronize direct fixes on `main` back to `develop` through an authorized merge.

## Branch operations

Inspect current Git status, branches, and relevant diffs. Verify the base and check name collisions. Fetch configured remote references when needed for a current starting point; report fetch failures or divergence rather than silently using stale references or resetting history.

Preserve staged, unstaged, and untracked work. Creating a branch at current HEAD can retain related changes when HEAD is the intended base. Do not transfer unrelated work, auto-stash, commit, or discard it to force a switch. Use an authorized isolated worktree or resolve the conflict with the user when needed. Never reset an existing branch using `git switch -C`.

Create or switch to the verified branch and report its name, base, and any synchronization limitation. If `develop` is missing, establish it from the verified stable branch only within the authorized scope.

## Merge gate and publishing

Before proposing a merge, use the existing [QA](../qa/SKILL.md) validation record and applicable [code-review](../code-review/SKILL.md) findings. Application changes require code review; documentation-only work needs a content review. Sensitive changes also use [security-review](../security-review/SKILL.md). Load only the relevant skills. Missing or stale checks go through QA, not a duplicate branch-specific test run.

Resolve blocking findings, confirm evidence applies to the candidate integration, then obtain user merge approval unless already provided. Passing checks do not grant approval. QA owns the scope of revalidation after conflict resolution or target changes.

## Commit and push frequency

The user authorizes atomic commits and normal pushes on the task branch during requested implementation work: commit and push after each meaningful, coherent milestone, and push remaining task commits before a pause or at task completion. Examples include a completed component, a working business-logic step, or added tests. Do not commit after every file edit or wait for the entire feature to be finished. Planning-only, review-only, and skill-editing requests do not themselves trigger publication.

This standing authorization covers only the verified task branch and intended configured GitHub repository, never direct pushes to `main` or `develop`. Honor any explicit local-only or no-push instruction. Verify the remote destination, branch, and outgoing commits before pushing; exclude unrelated work and secrets. Set upstream on the first push with `git push -u <remote> <task-branch>`; subsequently use the verified upstream. If the destination is missing or ambiguous, report it rather than creating or choosing a repository arbitrarily.

Use [git-commit](../git-commit/SKILL.md) for atomic commits. A coherent intermediate commit may be pushed before the whole feature is ready; disclose incomplete validation. Do not rerun full QA solely because of a push. Reuse valid evidence and perform focused checks for the milestone; the full applicable merge gate remains required before integration.

If a push fails, report the failure and preserve local commits; do not force-push or rewrite history to bypass rejection. Verify successful publication before reporting it. PR creation, merges, branch deletion, force-push, and history rewriting still require authorization covering those actions.

For authorized cleanup, verify integration and worktree usage; prefer `git branch -d` and investigate refusal instead of forcing deletion. Never delete `main` or `develop`. Remote deletion requires authorization for that action.
