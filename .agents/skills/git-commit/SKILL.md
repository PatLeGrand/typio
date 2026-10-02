---
name: git-commit
description: Prepare and create atomic Git commits for Typio using Conventional Commits when the user requests a commit or help preparing one.
---

# Git Commit

Create clean, atomic, understandable commits. Each commit must represent one logical change that is easy to review and revert. Create commits only within the scope authorized by the user; invoking this skill does not authorize pushing to a remote.

## Workflow

1. Run `git status` and review all modified and untracked files.
2. Inspect `git diff` and `git diff --staged`. Read relevant untracked files separately, since they do not appear in the diff.
3. Identify the files or hunks belonging to the requested change. Keep unrelated changes out of the commit and preserve existing user work, including unrelated staged changes.
4. Run relevant validation using the project's current scripts. Typio uses Bun: use `bun run lint` for source changes and `bun run build` when the change affects application behavior or build configuration. Every feature must include meaningful unit tests for new behavior and edge cases; bug fixes should include a regression test where applicable. Run relevant tests using the actual project setup. If no test setup exists, establish a minimal suitable one as part of feature implementation before declaring it ready. Add integration or browser coverage when unit tests cannot verify the behavior. Never claim a nonexistent test command passed. Documentation-only changes need a content and diff review rather than an application build.
5. If validation fails, report the failure and resolve issues within the authorized scope before committing. Do not claim that unavailable or failed checks passed.
6. Stage only the related files or hunks using explicit paths or selective staging. Review `git diff --staged` again and ensure the commit contains only the intended change. Never commit without reviewing the final staged diff.
7. Create the commit with the format below, then check `git status` and report the commit hash, message, validation performed, and any remaining changes.

Do not discard unrelated work, amend an existing commit, or rewrite history unless the user authorizes it. If unrelated staged changes cannot be safely isolated, explain the conflict before proceeding.

## Commit format

Use Conventional Commits:

```text
<type>(<scope>): <description>
```

Use a scope whenever possible. Write a concise English description starting with a lowercase imperative verb, without a trailing period. Describe the actual change; avoid vague messages such as `update` or `misc fixes`. Add a body when the reason or tradeoff needs explanation. Mark breaking changes with `!` and explain them in a `BREAKING CHANGE:` footer.

## Allowed types

- `feat`: new feature
- `fix`: bug fix
- `refactor`: internal code change without behavior change
- `perf`: performance improvement
- `style`: UI/CSS or formatting changes, following this project's convention
- `test`: adding or updating tests
- `docs`: documentation
- `chore`: maintenance or tooling
- `build`: build system or dependencies
- `ci`: CI/CD configuration

## Suggested scopes

Choose a stable domain rather than inventing a scope for every file:

`typing`, `lesson`, `exercise`, `keyboard`, `stats`, `progress`, `student`, `teacher`, `auth`, `profile`, `dashboard`, `ui`, `api`, `database`, `config`.

Reuse established scopes from the repository history when appropriate. Omit the scope for genuinely cross-cutting changes.

## Examples

```text
feat(typing): add typing speed calculation
fix(auth): prevent login with empty credentials
refactor(lesson): simplify lesson progression logic
style(ui): improve typing exercise layout
test(typing): add WPM calculation tests
docs(readme): add local setup instructions
```
