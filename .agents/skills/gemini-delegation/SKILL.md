---
name: gemini-delegation
description: Delegate read-only work to Gemini through the Antigravity CLI (`agy`) - repository search in place of scout, and second opinions on diffs (review, test design, accessibility and FR/EN copy, screenshots). Use before spawning scout and alongside the Claude validation chain.
---

# Gemini Delegation

Gemini runs on the user's own subscription, so its tokens cost no Claude quota. Use it as much as possible, but only for read-only work, and treat every answer as a lead to verify, never as evidence.

## Run

```bash
bun scripts/gemini/run.ts <task> [options] "<instruction>"
```

Run it from the checkout to inspect: the repository root and the diff come from the current directory.

| Task | Use | Context given to Gemini | Typical time |
|---|---|---|---|
| `search` | Replaces `scout`: locate code, read docs, "where/how is X done" | Every repository file and the installed Next.js docs | ~1 min |
| `review` | Second code review, in parallel with `code-reviewer` | Diff from the merge base with `--base` (default `origin/develop`), uncommitted and untracked files included | ~3 min |
| `tests` | Test cases to write and coverage gaps, before `qa` writes tests | Same diff | ~3 min |
| `ui` | Accessibility and FR/EN copy (UI-5) of a UI diff | Same diff | ~3 min |
| `visual` | Screenshot review: mobile, tablet and desktop, light and dark (UI-3, UI-4) | Headless captures of each `--url`, plus `--image` references | ~1.5 min |

Options: `--base <ref>`, `--url <url>` and `--image <path>` (both repeatable, images in PNG, JPEG or WebP only), `--model <id>`, `--keep`.

`visual` needs a running dev server and only captures the top of the page (one viewport). On success it keeps its screenshots and prints their folder: check findings against the images, then delete the folder. Mobile captures are framed at 375 px on a grey background, because headless browsers refuse windows narrower than about 500 px.

Each task tries a Pro model, then a Flash model (`search` starts with Flash). A model that fails (quota, error) hands over to the next one. A timeout, from `agy` or from the script's own safety net, stops immediately rather than doubling the wait. Long tasks fit well as background commands while Claude agents work.

The first run of the day, and the first run after `agy` or the hook changes, adds about 15 s for the read-only canary (see below).

## Exit codes and fallback

- `0`: Gemini's answer on stdout, then a footer with the model, Gemini tokens, duration, files read, and denied tool calls.
- `1`: usage error, for example an unknown task or no change against the base. Fix the call.
- `2`: `GEMINI_INDISPONIBLE`. Gemini failed (quota exhausted, error, timeout, empty answer, missing `agy`, read-only hook not proven). A message starting with `ALERTE` means Gemini could write despite the hook: tell the user and stop using it. **Continue exactly as before**: spawn `scout` for a search, and rely on the Claude chain alone for the other tasks. Do not retry in a loop.

## Trust rules

- **Verify before acting or relaying.** Open the cited `path:line` for every finding you keep. Gemini's line numbers are sometimes wrong while the substance is right. Drop findings you cannot confirm.
- **It never validates anything.** A Gemini answer does not replace `qa`, `code-reviewer` or `security-reviewer`, and is never reported as a passed check.
- **Known weak spots.** `visual` overstates contrast issues. `tests` tends to restate existing coverage. Weigh its findings accordingly.
- **Secrets stay out of the prompt.** Never paste secret values into the instruction.

## Read-only guarantee

`agy --mode plan` does **not** prevent writes. Read-only access comes from the `PreToolUse` hook in `scripts/gemini/sandbox/.agents/hooks.json`, which runs `scripts/gemini/guard.ts`:

- It allows only `view_file`, inside the repository and the context folder, after resolving the real path (`realpathSync.native`: links, 8.3 short names, case).
- It denies `.env*` files (except `.env.example`), keys and certificates, `.git/`, and ambiguous Windows forms (`~1` short names, `::$DATA` streams, trailing dots or spaces).
- It also denies commands, file writes, web access and subagents.

If the hook fails, `agy` blocks the tool. Before the first task, a canary run proves the hook still holds: one read must be allowed and logged, and one write attempt must be denied. The proof is cached for 24 h, keyed on the `agy` binary and the hook files. `run.ts` also checks the hook's log after each task.

`agy` receives an allow-listed environment, because Bun loads `.env.local` into `process.env`. Do not edit the hook or the policy (`scripts/gemini/policy.ts`, `guard.ts`, `canary.ts`, `agy.ts`) without a security review.

## Who calls it

- **Orchestrator**: every task.
- **`implementer`, `qa`**: `search` for broad exploration. `qa` also uses `tests` before writing missing tests.
- **`code-reviewer`, `security-reviewer`**: never. Their opinion must stay independent from Gemini's.
