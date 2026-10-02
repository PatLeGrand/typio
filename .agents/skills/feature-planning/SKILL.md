---
name: feature-planning
description: Define Typio feature scope, acceptance criteria, and test scenarios before implementation; scale planning to the change.
---

# Feature Planning

Own the intended behavior and acceptance criteria. Do not execute validation or repeat coding and Git policies.

Inspect relevant existing behavior, repository instructions, and project structure. Distinguish existing files from proposed additions. Ask only about missing decisions that materially affect acceptance, scope, or data handling; state safe assumptions and continue independent work.

Produce a concise plan in the user's language:

- User need and observable outcome.
- Included behavior and meaningful exclusions.
- Main user flow and applicable empty, loading, error, and retry states.
- Testable acceptance criteria with stable identifiers (AC-1, AC-2), inputs/actions, and expected outcomes.
- Relevant edge cases and a short implementation outline tied to actual project areas.
- Scenarios mapping acceptance criteria to unit, integration, or browser checks, with expected results and test data.
- Blocking decisions versus non-blocking assumptions.

For typing features, resolve only applicable product rules: WPM/accuracy formulas and rounding, corrected errors, timer start/end/restart, paste and backspace behavior, accents/composition, and persistence. Reuse documented rules; do not invent consequential behavior.

[QA](../qa/SKILL.md) owns test requirements and execution. If inspection shows no test setup, include establishing a minimal suitable setup in the implementation plan. Never report planned checks as completed. [Code quality](../code-quality/SKILL.md) owns implementation conventions and [git-branch](../git-branch/SKILL.md) owns branch/merge policy; load them only for those activities.

A planning-only request ends with the plan. If implementation is already authorized, continue without adding blanket plan approval; pause only dependent work for unresolved decisions. Small, clear changes need a few bullets, not a full specification. Documentation or trivial copy edits do not need feature planning unless requested. Keep the plan in chat unless saving it is requested or an existing project convention requires it.
