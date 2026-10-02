---
name: git-branch
description: Create, select, and manage task branches in Typio when starting implementation work or when the user requests Git branching operations.
---

# Git Branch

Use one short-lived branch per logical task. Keep the default branch stable and perform implementation work on task branches. Reuse the current branch when it already belongs to the requested task. Creating this skill does not itself require creating or switching branches.

## Branch strategy

- Typio currently uses `master`. Determine the default branch from the repository before acting; do not rename it or assume it is `main`.
- Start new, independent work from the default branch unless the user specifies another base. Use a task branch as a base only for intentionally dependent work.
- Do not introduce a permanent `develop` branch or release branches without a project requirement.
- Keep related commits together and split unrelated tasks into separate branches.

## Naming

Use `<type>/<short-description>` with lowercase English words separated by hyphens. Follow an explicit branch name supplied by the user.

Use the same types as the commit convention: `feat`, `fix`, `refactor`, `perf`, `style`, `test`, `docs`, `chore`, `build`, or `ci`. Include a domain in the description when helpful. Include an issue identifier only when one is provided or verified.

Examples:

```text
feat/typing-speed
fix/keyboard-input
refactor/lesson-progression
docs/local-setup
chore/commit-skills
```

## Workflow

1. Inspect `git status --short`, the current branch, local branches, and configured remotes. Inspect relevant diffs before moving existing work.
2. Determine the base using the user's instruction, then the remote default-branch reference when available, then the verified local default branch. If multiple candidates remain ambiguous, ask which base to use.
3. Reuse an existing branch for the same task. Check for a name collision before creating a branch; never reset an existing branch with `git switch -C`.
4. When a remote is configured and accessible, fetch its references before choosing the starting commit. Do not silently start from a stale remote reference if fetching fails; report the limitation. Compare local and remote history before selecting the base. Do not automatically merge, rebase, or reset a divergent local default branch.
5. Preserve staged, unstaged, and untracked work. If current changes belong to the task and the current HEAD is the intended base, `git switch -c <branch>` can retain them on the new branch. If unrelated changes or a different base make switching unsafe, use an authorized isolated worktree or ask how to handle the changes. Do not automatically stash, commit, discard, or transfer unrelated work.
6. For a clean working tree, create the branch with `git switch -c <branch> <verified-base>`, or switch to an existing appropriate branch with `git switch <branch>`. Do not overwrite local changes to force a switch.
7. Verify the resulting branch and working-tree status. Report the branch name, starting base, and any synchronization limitation.

## Publishing and cleanup

Local branch work does not authorize pushing, opening a pull request, merging, or deleting branches. Perform those actions when requested or already authorized in the conversation.

- For an authorized first push, use the verified remote and set the upstream with `git push -u <remote> <branch>`.
- Do not force-push or rewrite shared history without explicit authorization.
- Before authorized cleanup, verify the branch's work has been integrated and that it is not checked out in another worktree. Prefer `git branch -d`; if Git refuses, inspect the reason instead of forcing deletion.
- Never delete the default branch. Remote branch deletion requires authorization covering that remote action.

When a commit is requested, apply the project's `git-commit` skill for staged-diff review, validation, and commit messages.
