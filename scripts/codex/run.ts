import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { verifyReadOnlySandbox } from "./canary";
import { type ReadCommand, parseCli } from "./cli";
import {
  buildCodexArgs,
  describeFailure,
  parseCodexEvents,
  resolveCodexBinary,
  runCodex,
  safeEnv,
  throwIfInterrupted,
  watchInterrupts,
} from "./codex";
import { describeExit, UnavailableError, UsageError } from "./errors";
import { ensureQuota } from "./limits";
import { makeScratchDir, readDir, stateDir } from "./paths";
import { removeAllDependencyModels } from "./deps";
import { formatFooter } from "./report";
import {
  copySnapshot,
  git,
  gitRaw,
  isSensitivePath,
  listNextDocs,
  listRepoFiles,
  NEXT_DOCS_DIR,
  sensitiveExcludes,
} from "./snapshot";
import { buildPrompt, CONTEXT_FILE, TASKS } from "./tasks";
import { cleanBranch } from "./worktree";
import { cleanWorkdir } from "./workdir";
import { runVerify } from "./verifyCommand";
import { runWrite } from "./write";

/**
 * Délègue du travail à Codex (modèles ChatGPT) pour économiser des jetons Claude.
 *
 *   bun scripts/codex/run.ts <search|review|tests|ui> [options] "<consigne>"      lecture seule, copie expurgée
 *   bun scripts/codex/run.ts implement --level <1|2|4> --brief <fichier.md> …     écriture : copie sans git, puis worktree
 *   bun scripts/codex/run.ts qa --brief <fichier.md> …                            écriture : copie sans git, puis worktree
 *   bun scripts/codex/run.ts verify <codex/branche>                               lint, test, build du worktree
 *   bun scripts/codex/run.ts clean <codex/branche>                                supprime worktree et branche
 *   bun scripts/codex/run.ts clean --work <id>                                    supprime un dossier work gardé
 *   bun scripts/codex/run.ts clean --deps                                         supprime les modèles de dépendances (pas en parallèle d'autres tâches)
 *
 * Codes de sortie :
 *   0  réponse de Codex (ou rapport) sur stdout ; en écriture, même si une vérification échoue ;
 *   1  mauvaise utilisation (tâche inconnue, option invalide, aucun changement à relire…) ;
 *   2  Codex indisponible (binaire absent, quota, erreur, délai, réponse vide, canari en échec,
 *      copie, worktree ou installation impossible, ALERTE) : continuer sans lui.
 */

function resolveBase(root: string, base: string | undefined): string {
  if (base) return base;
  const hasRemote = gitRaw(root, ["rev-parse", "--verify", "--quiet", "origin/develop"]);
  return hasRemote.status === 0 ? "origin/develop" : "develop";
}

/** Le diff est calculé sur le vrai dépôt : la copie n'a pas d'historique git. */
function buildDiffContext(root: string, baseRef: string | undefined): string {
  const base = resolveBase(root, baseRef);
  const mergeBase = git(root, ["merge-base", base, "HEAD"], UsageError).trim();
  // Les fichiers sensibles (clé versionnée par erreur, par exemple) ne passent pas dans le diff.
  const changed = git(root, ["diff", "--name-only", "--no-renames", "-z", mergeBase]).split("\0").filter(Boolean);
  // Diff jusqu'à l'arbre de travail : les changements non commités comptent aussi.
  const diff = git(root, ["diff", "--no-renames", mergeBase, "--", ".", ":(exclude)bun.lock", ...sensitiveExcludes(changed)]);
  const untracked = git(root, ["ls-files", "--others", "--exclude-standard"])
    .split(/\r?\n/)
    .filter((file) => file !== "" && !isSensitivePath(file))
    .join("\n");
  if (diff.trim() === "" && untracked === "") {
    throw new UsageError(`Aucun changement par rapport à ${base}.`);
  }
  const log = git(root, ["log", "--oneline", `${mergeBase}..HEAD`]).trim();
  return `# Changement à examiner (base : ${base})

## Commits
${log || "(aucun commit, changements non commités seulement)"}

## Nouveaux fichiers non suivis (à ouvrir : ils sont dans ton dossier de travail)
${untracked || "(aucun)"}

## Diff
\`\`\`diff
${diff}
\`\`\`
`;
}

async function runRead(command: ReadCommand): Promise<number> {
  const task = TASKS[command.task];
  const model = command.model ?? task.model;
  const effort = command.effort ?? task.effort;

  const root = realpathSync.native(git(process.cwd(), ["rev-parse", "--show-toplevel"], UsageError).trim());
  // Le contexte est calculé d'abord : « aucun changement » est une erreur d'usage, sans copie ni appel.
  const context = task.context === "diff" ? buildDiffContext(root, command.base) : null;

  const bin = resolveCodexBinary();
  if (!bin) throw new UnavailableError("le binaire codex est introuvable (variable CODEX_BIN, PATH ou app desktop).");
  const interrupts = watchInterrupts();
  let tempDir: string | null = null;
  try {
    // Le quota passe avant le canari, qui coûte lui-même un appel à Codex.
    await ensureQuota(bin, command.quotaThreshold);
    const sandboxProblem = await verifyReadOnlySandbox(bin);
    if (sandboxProblem) throw new UnavailableError(sandboxProblem);
    throwIfInterrupted(interrupts.signal());

    // La copie est un sous-dossier : le fichier du dernier message, écrit par Codex lui-même,
    // reste à côté et n'est pas visible depuis son dossier de travail. Le tout est sous
    // `~/.typio-codex/read`, hors de `%TEMP%`.
    tempDir = realpathSync.native(makeScratchDir(readDir(), "read-"));
    const workDir = path.join(tempDir, "repo");
    const lastMessageFile = path.join(tempDir, "dernier-message.txt");
    mkdirSync(workDir);
    const copied = copySnapshot(root, listRepoFiles(root), workDir);
    const docs = copySnapshot(path.join(root, NEXT_DOCS_DIR), listNextDocs(root), path.join(workDir, NEXT_DOCS_DIR));
    const skippedFiles = copied.skipped.length + docs.skipped.length;
    if (context !== null) writeFileSync(path.join(workDir, CONTEXT_FILE), context);

    const started = Date.now();
    const run = await runCodex({
      bin,
      args: buildCodexArgs({ cwd: workDir, lastMessageFile, effort, model }),
      prompt: buildPrompt(task, command.instruction),
      timeoutMinutes: task.timeoutMinutes,
      env: safeEnv(),
    });
    throwIfInterrupted(interrupts.signal());
    if (run.missing) throw new UnavailableError("le binaire codex est introuvable.");

    const response = existsSync(lastMessageFile) ? readFileSync(lastMessageFile, "utf8").trim() : "";
    const events = parseCodexEvents(run.stdout);
    if (run.exitCode === 0 && !run.timedOut && response !== "") {
      const seconds = Math.round((Date.now() - started) / 1000);
      console.log(response);
      console.log(`\n---\n${formatFooter({ model, effort, sandbox: "read-only", usage: events.usage, seconds, skippedFiles })}`);
      return 0;
    }
    throw new UnavailableError(describeFailure(run, events, response));
  } finally {
    interrupts.dispose();
    if (tempDir !== null) {
      if (command.keep) console.error(`Dossier conservé : ${tempDir} (copie dans ${path.join(tempDir, "repo")})`);
      // Windows peut garder un fichier verrouillé un instant après la fin de Codex.
      else rmSync(tempDir, { recursive: true, force: true, maxRetries: 3 });
    }
  }
}

async function main(): Promise<number> {
  const command = parseCli(process.argv.slice(2));
  if (command.kind === "clean") {
    const root = realpathSync.native(git(process.cwd(), ["rev-parse", "--show-toplevel"], UsageError).trim());
    for (const removed of cleanBranch(root, command.branch)) console.log(`Supprimé : ${removed}`);
    return 0;
  }
  if (command.kind === "cleanWork") {
    console.log(`Supprimé : ${cleanWorkdir(command.id)}`);
    return 0;
  }
  if (command.kind === "cleanDeps") {
    // Suppression totale : modèles, temporaires et entrées étrangères, sans suivre de lien.
    removeAllDependencyModels(stateDir());
    console.log("Modèles de dépendances supprimés.");
    return 0;
  }
  if (command.kind === "verify") {
    const root = realpathSync.native(git(process.cwd(), ["rev-parse", "--show-toplevel"], UsageError).trim());
    return runVerify(root, command);
  }
  return command.kind === "write" ? runWrite(command) : runRead(command);
}

try {
  process.exitCode = await main();
} catch (error) {
  const { code, message } = describeExit(error);
  console.error(message);
  process.exitCode = code;
}
