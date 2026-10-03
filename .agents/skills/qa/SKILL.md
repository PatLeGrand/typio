---
name: qa
description: Execute and consolidate Typio validation checks for changed code or release readiness, reusing valid evidence.
---

# QA

Own test requirements, check execution, and the shared validation record. Verify observable behavior against acceptance criteria; code-review owns static implementation review and security-review owns targeted security analysis. Do not repeat their reviews.

## Coverage and execution

- Every feature must include meaningful unit tests for testable new behavior, boundaries, and expected errors. Bug fixes need regression coverage where applicable. Add integration/browser coverage when unit tests cannot establish the behavior.
- Implementation work includes establishing a minimal suitable test setup when none exists. A review-only QA request reports missing setup or coverage as a blocker rather than silently installing tooling or writing the feature.
- Inspect actual scripts and configuration. Typio uses Bun; discover test commands rather than inventing them. Use `bun run lint` and `bun run build` when those remain the actual project scripts.
- For an application feature, run relevant unit/regression tests, lint, build, and acceptance checks. For a release, require the full available suite, lint, build, and important user journeys on the integrated candidate.
- For a narrow fix, target affected behavior and dependencies; do not trigger unrelated audits or a full feature plan. Documentation-only work needs content/diff/link checks, with application checks marked not applicable. Configuration changes need checks relevant to their runtime/build impact.
- Use browser evidence for visual or interaction claims. Use local/test data; unavailable required browser access or services are blocked checks, never implicit passes.

## Shared validation record

Maintain one compact record in the current conversation or existing task artifact; no new report file is required. Include:

- Scope and acceptance criteria; source/target revisions when relevant.
- Tested commit plus identification of any staged, unstaged, or untracked content included. Use a tree/diff fingerprint or a precise snapshot description sufficient to establish content equality; a commit hash alone is insufficient for dirty work.
- Relevant dependency/configuration/environment identity.
- Each command or scenario, outcome (passed/failed/blocked/not applicable), evidence, and whether run now or reused.
- Remaining findings and blockers, referring to existing review findings instead of duplicating them.

Reuse a result only when its tested inputs, relevant dependencies/configuration/environment, and required scope still match. Never reuse evidence from a larger dirty tree for a partial staged commit without verifying equivalence. Missing evidence means unverified, not passed.

After a change, rerun affected checks and any checks whose validity is uncertain. Conflict resolution, target changes, dependencies, and test configuration can invalidate evidence. A new commit hash alone does not invalidate checks if tested content is identical. Release validation must cover the integrated candidate; feature-only results do not substitute for full release coverage. Existing full results for the identical candidate may be reused.

Code-review and security-review may run focused reproductions to investigate a finding; add those results here and do not repeat them without a reason. Ordinary coding feedback tests may also be reused under the same rules.

## Result

Report briefly in the user's language: scope, checks/evidence, observed failures with reproduction and expected/actual results, blockers, and next action.

- PASS: applicable required checks completed successfully and no unresolved acceptance failures or blocking findings.
- FAIL: a required check or acceptance criterion failed; also disclose blocked checks.
- BLOCKED: required evidence is missing and no confirmed failure already determines FAIL.

Disclose non-blocking findings. Do not weaken tests to obtain a pass. If fixes are authorized, rerun affected validation afterward; otherwise report the defect. Stop repetitive attempts when an external dependency or decision is required.

Merge approval and strategy belong exclusively to [git-branch](../git-branch/SKILL.md). A QA pass does not authorize a Git or deployment action.
