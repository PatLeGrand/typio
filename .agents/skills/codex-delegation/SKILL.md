---
name: codex-delegation
description: Route substantial Typio work to Codex subagents when independent research, implementation, QA, or review can reduce context use without creating file conflicts. Use only in Codex; never manage Claude agents or Claude worktrees.
---

# Codex Delegation

Coordinate subagents inside the current Codex thread. The primary agent remains
responsible for scope, decisions, integration, validation, user communication,
Git operations, and external side effects.

## Decide whether to delegate

Delegate only when the expected work saved is greater than the coordination cost.
Good candidates are independent repository research, a bounded implementation with
exclusive file ownership, QA after implementation, code review, or a requested
security review.

Handle the work directly when it is a small edit, needs frequent shared decisions,
depends on rapidly changing results, or would make multiple agents touch the same
files. Do not spawn agents merely to follow a fixed checklist or repeat evidence
already available.

## Keep Codex and Claude isolated

- Use only Codex collaboration tools and agents in the current Codex thread tree.
- Do not edit `CLAUDE.md`, `.claude/**`, or Claude-managed worktrees unless the user
  explicitly requests that change.
- Do not reuse, merge, interrupt, or infer the state of Claude agents. Treat their
  files and worktrees as user-owned concurrent work.
- Codex agents share a filesystem. Assign exclusive file sets and preserve all
  changes that were not produced by the delegated task.

## Route the work

- **Discovery:** delegate a narrow read-only question when its answer can be returned
  as paths, findings, or a short recommendation.
- **Mechanical changes:** delegate only when the specification and owned files are
  exact. Use the lowest adequate reasoning effort.
- **Feature implementation:** give one agent a cohesive slice with acceptance
  criteria and exclusive files. Keep architecture and cross-slice decisions with
  the primary agent.
- **QA and review:** run after the candidate change exists. Reuse existing evidence;
  invoke the project `qa`, `code-review`, or `security-review` skill only when its
  scope applies.
- **Git, deployment, infrastructure, and destructive actions:** keep coordination
  with the primary agent. Delegate bounded analysis only; subagents do not commit,
  push, merge, deploy, or alter external systems unless the user explicitly assigns
  that action to them.

Run independent tasks in parallel. Run dependent tasks sequentially, especially
implementation before QA and review. Respect the available agent capacity and keep
one slot for the primary agent; more agents are not automatically more efficient.

## Write compact, autonomous briefs

Prefer `fork_turns: "none"` and provide the minimum context needed. Fork recent turns
only when the user's exact wording or a live decision is essential. A brief includes:

1. the concrete objective and expected deliverable;
2. relevant repository paths and verified facts;
3. files the agent may edit, or an explicit read-only boundary;
4. applicable constraints and acceptance criteria;
5. checks to run and the requested result format;
6. prohibited side effects, including commit, push, merge, deployment, and edits to
   Claude-owned files.

Do not ask several agents to rediscover the same context. Pass useful findings from
one stage into the next brief. Continue with `followup_task` when the same agent and
context remain appropriate instead of spawning a replacement.

## Integrate results

Treat agent output as evidence, not as automatically accepted work. Inspect changed
files and diffs, reconcile findings with repository rules, and run the smallest
meaningful validation that covers the integrated result. If an agent reports an
ambiguity, the primary agent decides it or asks the user when the choice materially
changes the product.

Report failures faithfully. Do not label an unrun check as successful, repeat a
failed brief unchanged, or expand user authorization through delegation.
