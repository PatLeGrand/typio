---
name: codex-routing
description: Route Typio work from the Claude orchestrator to OpenAI Codex models (GPT-6 Luna, GPT-5.6 Terra, GPT-6.1 Sol) through `scripts/codex/run.ts` - mechanical changes, well-scoped features, QA, and read-only search when Gemini is unavailable. Use to save Claude tokens; never from Codex itself (see codex-delegation).
---

# Codex Routing

Codex runs on the user's ChatGPT Plus subscription, so its tokens cost no Claude quota. Use it for the volume of simple code and QA, and keep Claude for judgment and validation. Every Codex result is a candidate to verify, never evidence on its own.

## Escalation ladder

| Level | Work | Who | Fallback if Codex is unavailable or fails |
|---|---|---|---|
| 1 | Mechanical and easy to verify: FR/EN keys, copy, renames, lint, doc tables, extraction, synthesis | `implement --level 1` (GPT-6 Luna, medium) | `implementer-light` (haiku) |
| 2 | Simple feature or fix framed by AC-n, with its unit tests; QA | `implement --level 2` (GPT-5.6 Terra, medium); `qa` (Terra, medium) | `implementer` / `qa` (sonnet) |
| 3 | Difficult feature | `implementer` (sonnet) | none |
| 4 | Harder still, heavy reasoning, little code | `implement --level 4` (GPT-6.1 Sol, medium) | orchestrator (opus) |
| 5 | Plan, data model, architecture, realtime protocol, debug with no known cause | orchestrator (opus) | none |

Sol costs the most quota: give it targeted, low-volume work. When a level fails or stops on an ambiguity, decide the point or move **up** one level; never resend the same brief to the same level.

Codex never replaces `code-reviewer` or `security-reviewer`, and Gemini keeps its second opinions. The read tasks `review`, `tests` and `ui` (Terra, `--base <ref>`, from the checkout to inspect) give an extra second opinion in parallel with Gemini, with the same trust rules: verify every finding before relaying it, never report it as a passed check. Implementation work has priority on the ChatGPT quota: skip them when a window is past half.

## Run

Write the brief to a Markdown file (scratchpad), self-contained as CLAUDE.md rule 2 requires: requirement IDs, files, AC-n, decisions taken, what not to touch. Then, from the checkout whose `HEAD` Codex should start from:

```bash
bun scripts/codex/run.ts implement --level <1|2|4> --brief <brief.md> [--checks none|lint] [--from <ref>] [--branch codex/<name>]
bun scripts/codex/run.ts qa --brief <brief.md> [--from <ref>]
bun scripts/codex/run.ts verify codex/<branch> [--checks lint,test,build]
bun scripts/codex/run.ts search "<question>"
bun scripts/codex/run.ts clean codex/<branch>
bun scripts/codex/run.ts clean --work <id>
bun scripts/codex/run.ts clean --deps
```

Other options: `--model`, `--effort`, `--seuil-quota <percent>` (default 90), `--keep` (keep the work folder `work/<id>`, removed later with `clean --work <id>`; for a read task, keep the copy), `--sortie-bac-a-sable "<reason>"`.

- Codex never writes in a git repository. It works in a plain extraction of `--from` (default `HEAD`) under `~/.typio-codex/work/<id>/src/`, and no `.git`. Uncommitted changes of the calling checkout are **not** visible to it: commit them first (WIP commit if needed).
- **Dependencies.** Level 1 gets no `node_modules`: mechanical changes do not need them, and Codex is told not to run lint, tsc or tests. Levels 2 and 4 and `qa` get a copy of a dependency model kept under `~/.typio-codex/state/deps/<sha256 of package.json, bun.lock and bunfig.toml>/`. A model is built **only** from the start commit, before Codex runs (`bun install --backend=copyfile`, about 2.5 minutes, once per set of dependency files), then copied with `robocopy` (about 30 seconds). It is never linked: a junction would let Codex delete files in it. The most recently used models are kept (at least 3, and any used in the last 30 minutes). Every model is deleted after a `--sortie-bac-a-sable` run and after an ALERTE. `clean --deps` removes them all; do not run it, or a `--sortie-bac-a-sable` task, in parallel with other Codex tasks.
- **No automatic check by default** (`VERIFICATIONS (bac à sable) : AUCUNE`). `--checks lint` still runs `lint` inside the Codex sandbox after Codex finishes, with a throwaway `CODEX_HOME`, but it costs 2 to 4 minutes on fresh files and `verify` runs it again anyway. On Windows the sandbox forbids Node and Bun child processes, so `test` and `build` can never run there.
- Then it compares the extraction with a pristine copy, without running git on it, and refuses (`ALERTE`) any `.git` entry, `.gitmodules`, link, new sensitive file or `.codex/` folder. Only the added, modified and deleted files that git would track are copied into a fresh worktree under `~/.typio-codex/worktrees/`, on a `codex/*` branch: Codex never saw that worktree. Ignored files Codex created are listed in the report but not copied. If nothing changed, no worktree is created.
- **`lint`, `test` and `build` run with `verify`, and only after you have read the full diff**: they execute code written by Codex outside the sandbox, with the network and a local `DATABASE_URL` (never `AUTH_*`). `verify` first replaces `node_modules/` with a fresh copy of the model whose fingerprint matches the worktree's dependency files. If Codex changed `package.json`, `bun.lock` or `bunfig.toml`, no model matches: `verify` runs `bun install` directly in the worktree, so their lifecycle scripts run outside the sandbox (read them first), and nothing is stored as a model for later tasks. Then it prints each real exit code, then `VERIFICATIONS : OK` or `ECHEC (...)`.
- The report ends with the worktree diff (`git status`, `git diff --stat`), its path and branch, and a footer with model, effort, sandbox mode, tokens and duration.
- Long tasks fit well as background commands while Claude agents work on other files.

## Exit codes and fallback

- `0`: Codex finished and the report is printed. **Read the VERIFICATIONS lines**: exit 0 does not mean any check passed, and `test`/`build` have not run yet.
- `1`: usage error, fixed by correcting the call. Examples: unknown task or option, an option that does not apply to the task, missing question or brief, `--level 3`, `--level` on `qa`, sensitive brief path, invalid or existing branch, unknown `--from`, `--from`/`--base`/`--branch` starting with `-`, invalid `--model` or `--effort`, `--seuil-quota` outside 0-100, `--checks` other than `lint`/`none` on a write task (any script list is accepted with `--sortie-bac-a-sable`), empty sandbox-escape reason, `clean`/`verify` on a branch or path the wrapper did not create, no change to review. The full list is in `scripts/codex/cli.ts`.
- `2`: `CODEX_INDISPONIBLE` (quota, missing binary, canary failure, timeout, empty answer, worktree, install or git failure). Use the fallback column of the ladder. Do not retry in a loop.
- A worktree or work folder left after code 2 is printed with its `clean` command (`clean codex/<branch>` or `clean --work <id>`). Run it once you are done with it.
- `ALERTE` means a guard tripped: a canary proved a sandbox does not hold; Codex's extraction contained a `.git` entry, `.gitmodules`, link, new sensitive file, `.codex/` folder or a secret value (the work folder is kept as evidence, no git command ran on it); or `verify` found files hidden by a `.gitignore` (nothing was run). Tell the user and stop using Codex until it is understood.
- `NOTE : le dossier appelant a changé…` is informational: another agent may have written there. Check before trusting either side.

## Integrate a result

1. Read the Codex answer, the `A RELIRE EN PRIORITÉ` block (`.gitattributes`, `.gitignore`, `bun.lock`, `package.json`, `.github/`…), the VERIFICATIONS line, the list of ignored files Codex created and the list of added files. Then read the full diff with `git -C <worktree> diff --no-textconv --no-ext-diff -a <start>` and open every added file: a `.gitattributes` or `.gitignore` written by Codex can hide content from a plain `git diff` or `git status`. Drop anything outside the brief. Look closely at test files, configs and anything executed by `test` or `build`.
2. Run `verify codex/<branch>`.
3. Run the validation chain on that diff (CLAUDE.md rule 5): `code-reviewer`, `security-reviewer` if the surface is sensitive, Gemini `review` in parallel, plus `ui` and `visual` if the interface changes.
4. Fix small findings yourself or send a new brief one level up.
5. The orchestrator commits in the Codex worktree (git-commit skill), then brings the commit into the working branch (`git merge --ff-only codex/<branch>` or `git cherry-pick`), then runs `clean`.
6. For a Codex `qa` pass on that work, commit first, then `qa --from codex/<branch>`.

## Sandbox

- By default Codex writes only in its plain extraction (`workspace-write`, `--strict-config`), with the network off and no secrets in its environment. Every git command the wrapper runs disables `core.fsmonitor`, hooks and submodule recursion.
- `--sortie-bac-a-sable "<reason>"` switches to `danger-full-access`. The user allows it case by case when the task needs it (local database, E2E, package install). Use it only then, with a reason that names the need; the report shows it. **This mode means full trust and guarantees nothing**: Codex has the network, can read `.env.local` and `~/.codex/auth.json`, and can modify the wrapper, `.git/config` or the calling checkout, so the comparison, the ALERTE and NOTE messages and the canaries prove nothing for that run. Its environment stays filtered (except a local `DATABASE_URL`), all checks run automatically outside the sandbox, and the canary caches and dependency models are deleted afterwards so the next run proves the sandbox again and rebuilds its models from a trusted commit. Bun's global cache (`~/.bun/install/cache`), which the models are installed from, is **not** cleaned: after such a run, consider `bun pm cache rm` before the next install.
- **Residual risk:** even in the sandbox, Codex can read the whole disk. Worktrees and state live outside the repository (`~/.typio-codex/`) and the prompts forbid reading `.env*` and `~/.codex`, but nothing enforces it. Before the copy into the worktree, the wrapper raises an ALERTE if a changed file contains a value from `.env.local` or `~/.codex/auth.json` (plain or base64, the value is never printed; a value already present in a tracked file of the start commit, such as a public origin, is not treated as a secret). Another encoding would get through: still read the diff for secrets before committing.
- A new `.env*` file always raises an ALERTE, even a harmless `.env.test`: write such a file yourself after review if the task needs it.

## Quota

Before each task the wrapper reads the ChatGPT limits (`codex app-server`, `account/rateLimits/read`). It exits with code 2 and the reset time when either window (5 hours and 7 days, as reported by the server) is at or above `--seuil-quota`, when ordinary usage is not allowed, or when a rate limit is reported as reached. If the limits cannot be read, it warns and continues.

## Who calls it

- **Orchestrator** only: every task, including `verify` and `clean`.
- Claude agents never call Codex. Their work and their reviews stay independent from Codex's.
