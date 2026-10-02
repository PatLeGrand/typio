---
name: code-review
description: Inspect Typio changes for concrete bugs, regressions, test gaps, and coding-rule violations before merge or on request.
---

# Code Review

Own static implementation review. [Code quality](../code-quality/SKILL.md) owns coding conventions; [QA](../qa/SKILL.md) owns coverage requirements, check execution, and reusable evidence. Read applicable rules without copying them into the review report.

## Inspect

- Establish the requirements and exact scope: source/base revisions and any working-tree changes included. Use the verified merge base for a branch diff; inspect relevant target changes for integration risks. Include relevant untracked files for working-tree review.
- Read changed functions, callers, state/data flow, and tests. Verify framework-dependent assumptions against installed documentation.
- Look for reachable correctness failures, error handling, races, stale state, effect cleanup, compatibility, and user-facing regressions.
- Apply code-quality conventions, including its one-component-per-file rule and exceptions. Report concrete maintenance costs rather than preferences or speculative abstractions.
- Examine whether test assertions actually detect the changed behavior and relevant edge cases. Identify specific missing coverage under QA's policy; do not rerun the general validation suite.
- Flag obvious security issues encountered. For changed authentication, authorization, sensitive data, or trust boundaries, use [security-review](../security-review/SKILL.md) for the focused analysis; do not duplicate its audit.

Prioritize issues introduced or worsened by the diff. Mention pre-existing issues separately only when they materially block this work. A focused test or local reproduction is appropriate to resolve a suspected bug; contribute its evidence to QA's record. Reuse existing valid results and distinguish unverified suspicions from findings.

## Report

Give each actionable finding a priority, verified file/line, trigger, concrete impact, and smallest useful correction:

- P0: immediate broadly applicable critical failure.
- P1: major broken behavior or serious regression.
- P2: concrete defect, required coverage gap, or explicit coding-rule violation.
- P3: optional limited-impact improvement, separate from blockers.

Use the user's language. Lead with findings; report no findings when none are supported. End with **Changes requested** for unresolved P0-P2 findings, **Review incomplete** when essential review evidence is missing, or **No blocking findings** otherwise. This status covers code review only; disclose QA readiness separately without relaunching it.

Review-only requests do not modify code. Authorized fixes require focused re-review of affected code. Merge policy and approval belong to [git-branch](../git-branch/SKILL.md); a clean review does not authorize merging.
