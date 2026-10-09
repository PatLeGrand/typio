import { existsSync, readFileSync, realpathSync, rmSync } from "node:fs";
import path from "node:path";
import type { WriteCommand } from "./cli";
import { clearCanaryCaches, verifySandboxCommand, verifyWorkspaceWriteSandbox } from "./canary";
import { collectChanges, gitIgnoreCheck, hasChanges, scanSrc, type IgnoreCheck } from "./collect";
import {
  buildCodexArgs,
  describeFailure,
  parseCodexEvents,
  resolveCodexBinary,
  runCodex,
  safeEnv,
  throwIfInterrupted,
  watchInterrupts,
  type SandboxMode,
} from "./codex";
import { TamperedWorkError, UnavailableError, UsageError } from "./errors";
import { cleanDependencyModels, copyDependencies, type DependencyDeps } from "./deps";
import { ensureQuota } from "./limits";
import { makeScratchDir, stateDir } from "./paths";
import { buildNoChangeReport, buildWriteReport, formatFooter, priorityReviewFiles } from "./report";
import { assertNoSecrets, defaultSecretSources, withoutPublicValues, type SecretSource } from "./secrets";
import { git } from "./snapshot";
import { buildWritePrompt, resolveWriteProfile } from "./tasks";
import { transferToWorktree } from "./transfer";
import { formatChecks, formatSandboxChecks, runChecks, runSandboxedChecks, type CheckExecutor, type CheckResult } from "./verify";
import { extractBase, judgeFailedWork, prepareWorkdir, removeDir, type Workdir } from "./workdir";
import { changedLines, defaultBranchName, preflightWorktree, statusLines, type Worktree } from "./worktree";

/**
 * Tâches d'écriture (`implement`, `qa`). Codex n'écrit jamais dans un dépôt git :
 *   1. `work/<id>/src` : extraction du commit de départ, sans `.git` ;
 *   2. Codex travaille dans `src` (sans réseau, `workspace-write`) ;
 *   3. balayage de `src` seul (`.git`, `.gitmodules`, liens, `.codex/`), puis le lint dans le bac à sable de Codex ;
 *   4. `work/<id>/base` est extraite du même commit APRÈS Codex (il ne peut pas altérer la référence) ;
 *   5. `collect.ts` compare `src` à `base` en Node pur (aucun git sur `src`) et refuse ce qui est piégé ;
 *      si Codex échoue, la même comparaison décide de garder ou non le travail partiel ;
 *   6. les fichiers changés sont comparés aux valeurs secrètes (`secrets.ts`) ;
 *   7. un worktree neuf reçoit seulement les fichiers changés (`transfer.ts`) ; `work/<id>` est supprimé.
 * Le dossier appelant n'est jamais modifié : son `git status` est comparé avant et après.
 */

/** Ce qui se remplace dans les tests de `runWrite` : binaire, canaris, dépendances, Codex, lint, dossiers. */
export type WriteDeps = {
  cwd?: string;
  resolveBinary?: () => string | null;
  ensureQuota?: (bin: string, threshold: number) => Promise<void>;
  verifyWriteCanary?: (bin: string) => Promise<string | null>;
  verifySandboxCanary?: (bin: string) => Promise<string | null>;
  copyDependencies?: (cwd: string, stateParent: string, deps?: DependencyDeps) => void;
  runCodex?: typeof runCodex;
  /** Exécuteur du lint dans le bac à sable de Codex, sur `src`. */
  runLint?: (bin: string, names: readonly string[], src: string) => CheckResult[];
  /** Exécuteur des vérifications du mode `--sortie-bac-a-sable`, dans le worktree neuf. */
  execute?: CheckExecutor;
  ignoreCheck?: (root: string) => IgnoreCheck;
  secretSources?: (root: string) => SecretSource[];
  /** Remplacent `~/.typio-codex/work`, `~/.typio-codex/worktrees` et `~/.typio-codex/state`. */
  workParent?: string;
  worktreesRoot?: string;
  stateParent?: string;
};

/** Garde-fou : le dossier appelant ne devrait pas changer pendant la tâche. Information, pas échec. */
function reportCallerChanges(root: string, before: readonly string[]): void {
  let after: string[];
  try {
    after = statusLines(root);
  } catch {
    return;
  }
  const changed = changedLines(before, after);
  if (changed.length > 0) {
    const shown = changed.slice(0, 20).map((line) => line.trim());
    const more = changed.length > shown.length ? ` … (+${changed.length - shown.length})` : "";
    console.error(`NOTE : le dossier appelant a changé pendant la tâche (un autre agent a pu écrire) : ${shown.join(", ")}${more}`);
  }
}

/** Un échec de git après le lancement de Codex n'est pas une erreur d'usage : Codex est inutilisable, code 2. */
function afterTask<T>(action: () => T): T {
  try {
    return action();
  } catch (error) {
    if (error instanceof UsageError) throw new UnavailableError(error.message);
    throw error;
  }
}

const cleanWorkHint = (work: Workdir): string => `Nettoyage : bun scripts/codex/run.ts clean --work ${work.id}`;

export async function runWrite(command: WriteCommand, deps: WriteDeps = {}): Promise<number> {
  const briefPath = path.resolve(command.briefPath);
  if (!existsSync(briefPath)) throw new UsageError(`Brief introuvable : ${command.briefPath}`);
  const brief = readFileSync(briefPath, "utf8");
  if (brief.trim() === "") throw new UsageError(`Brief vide : ${command.briefPath}`);

  const root = realpathSync.native(git(deps.cwd ?? process.cwd(), ["rev-parse", "--show-toplevel"], UsageError).trim());
  const base = resolveWriteProfile(command.task, command.level);
  const profile = { ...base, model: command.model ?? base.model, effort: command.effort ?? base.effort };
  const sandbox: SandboxMode = command.sandboxExitReason ? "danger-full-access" : "workspace-write";
  // Branche et point de départ sont contrôlés d'abord : une faute de frappe ne doit coûter ni quota ni canari.
  const branch = command.branch ?? defaultBranchName(command.task);
  const startPoint = preflightWorktree(root, branch, command.from);

  const bin = (deps.resolveBinary ?? resolveCodexBinary)();
  if (!bin) throw new UnavailableError("le binaire codex est introuvable (variable CODEX_BIN, PATH ou app desktop).");
  const stateParent = deps.stateParent ?? stateDir();

  const interrupts = watchInterrupts();
  let work: Workdir | null = null;
  let worktree: Worktree | null = null;
  let keepWork = command.keep;
  // Vrai de la réussite de Codex jusqu'au worktree créé : une erreur entre les deux perdrait son travail.
  let unreported = false;
  let canariesReset = false;
  let tempDir: string | null = null;
  let before: string[] = [];
  try {
    // Le quota passe avant les canaris et avant toute copie : rien à nettoyer s'il est atteint.
    await (deps.ensureQuota ?? ensureQuota)(bin, command.quotaThreshold);
    if (sandbox === "workspace-write") {
      const sandboxProblem = await (deps.verifyWriteCanary ?? verifyWorkspaceWriteSandbox)(bin);
      if (sandboxProblem) throw new UnavailableError(sandboxProblem);
      // Le lint de `src` tourne dans `codex sandbox` : son bac à sable a sa propre preuve.
      if (command.checks.length > 0) {
        const lintSandboxProblem = await (deps.verifySandboxCanary ?? verifySandboxCommand)(bin);
        if (lintSandboxProblem) throw new UnavailableError(lintSandboxProblem);
      }
    } else {
      console.error("Canaris sautés : le bac à sable est levé pour cette tâche.");
    }
    throwIfInterrupted(interrupts.signal());

    before = statusLines(root);
    if (before.length > 0) {
      console.error(
        `AVERTISSEMENT : ${before.length} changement(s) non commité(s) dans le dossier appelant ; Codex ne les verra pas (la copie part de ${command.from}).`,
      );
    }
    const dir = afterTask(() => prepareWorkdir(root, startPoint, deps.workParent));
    work = dir;
    console.error(`Copie de travail créée : ${dir.dir} (src/, sans git, depuis ${command.from}).`);

    tempDir = realpathSync.native(makeScratchDir(stateParent, "run-"));
    const lastMessageFile = path.join(tempDir, "dernier-message.txt");
    if (command.task === "qa" || command.level !== 1) (deps.copyDependencies ?? copyDependencies)(dir.src, stateParent);
    throwIfInterrupted(interrupts.signal());

    const isIgnored = (deps.ignoreCheck ?? gitIgnoreCheck)(root);
    const started = Date.now();
    let run;
    try {
      run = await (deps.runCodex ?? runCodex)({
        bin,
        args: buildCodexArgs({ cwd: dir.src, lastMessageFile, effort: profile.effort, model: profile.model, sandbox }),
        prompt: buildWritePrompt({ task: command.task, level: command.level, brief, sandboxExitReason: command.sandboxExitReason }),
        timeoutMinutes: profile.timeoutMinutes,
        env: safeEnv(process.env, { localDatabase: sandbox === "danger-full-access" }),
      });
    } finally {
      // Sans bac à sable, Codex a pu écrire partout, y compris dans les caches des canaris et dans les
      // modèles de dépendances que `verify` copie hors bac à sable : on les refait.
      if (sandbox === "danger-full-access") {
        clearCanaryCaches(stateParent);
        cleanDependencyModels(stateParent);
        canariesReset = true;
      }
    }

    // Échec après le lancement de Codex : le travail partiel est gardé s'il a changé `src` (ou si on ne peut
    // pas le savoir). Une ALERTE (travail piégé) remonte à la place de l'échec.
    const fail = (error: Error): never => {
      const verdict = judgeFailedWork(root, startPoint, dir, isIgnored);
      if (verdict.keep) {
        keepWork = true;
        console.error(`Travail partiel de Codex conservé : ${verdict.reason}.`);
      }
      throw error;
    };
    const interruption = interrupts.signal();
    if (interruption) fail(new UnavailableError(`interrompu (${interruption})`));
    if (run.missing) throw new UnavailableError("le binaire codex est introuvable.");

    const response = existsSync(lastMessageFile) ? readFileSync(lastMessageFile, "utf8").trim() : "";
    const events = parseCodexEvents(run.stdout);
    if (run.exitCode !== 0 || run.timedOut || response === "") fail(new UnavailableError(describeFailure(run, events, response)));

    // Codex a réussi : jusqu'au worktree, une erreur garde `work/`.
    unreported = true;
    // Balayage de `src` seul, avant tout lancement dans le bac à sable (le lint lit `src`).
    scanSrc(dir.src);
    // Dans le bac à sable : seulement `lint`, dans le bac à sable de Codex, sur `src` ; le reste se lance
    // avec `verify` après relecture du diff. Bac à sable levé : tout tourne dans le worktree neuf, plus bas.
    const sandboxChecks = sandbox === "workspace-write" ? (deps.runLint ?? runSandboxedChecks)(bin, command.checks, dir.src) : [];
    throwIfInterrupted(interrupts.signal());

    // La référence est extraite maintenant : Codex n'a jamais pu la modifier. Aucun git ne tourne sur `src` :
    // parcours en Node pur, `check-ignore` depuis le dépôt principal.
    afterTask(() => extractBase(root, startPoint, dir));
    const changes = afterTask(() => collectChanges(dir.base, dir.src, isIgnored));
    // Aucune valeur secrète du `.env.local` ni de `auth.json` ne passe dans le diff (hors valeurs déjà publiques dans `base/`).
    const secrets = withoutPublicValues(dir.base, (deps.secretSources ?? defaultSecretSources)(root));
    assertNoSecrets(dir.src, [...changes.added, ...changes.modified], secrets);
    const footer = (): string =>
      formatFooter({ ...profile, sandbox, sandboxExitReason: command.sandboxExitReason, usage: events.usage, seconds: Math.round((Date.now() - started) / 1000) });

    if (!hasChanges(changes)) {
      console.log(
        buildNoChangeReport({
          lastMessage: response,
          checks: sandbox === "workspace-write" ? formatSandboxChecks(sandboxChecks, null) : "VERIFICATIONS : AUCUNE (aucun changement, rien à vérifier)",
          footer: footer(),
          sandboxExitReason: command.sandboxExitReason,
          ignored: changes.ignored,
          canariesReset,
        }),
      );
      return 0;
    }

    // Codex est terminé : le worktree n'a jamais été vu par lui, il reçoit seulement ses changements.
    // Si le report échoue, le worktree incomplet est défait et la copie de travail reste la source.
    const transfer = transferToWorktree({ root, branch, startCommit: startPoint, srcDir: dir.src, changes, worktreesRoot: deps.worktreesRoot });
    unreported = false;
    const created = transfer.worktree;
    worktree = created;
    console.error(`Worktree créé : ${created.path} (branche ${created.branch}, depuis ${command.from}).`);
    throwIfInterrupted(interrupts.signal());
    const { status, stat } = transfer;

    let checksText: string;
    if (sandbox === "danger-full-access") {
      // Bac à sable levé : toutes les vérifications tournent ici, dans le worktree neuf, après une copie neuve.
      (deps.copyDependencies ?? copyDependencies)(created.path, stateParent);
      throwIfInterrupted(interrupts.signal());
      const baseline = afterTask(() => statusLines(created.path));
      const results = runChecks(command.checks, created.path, deps.execute);
      throwIfInterrupted(interrupts.signal());
      // Les vérifications ont pu écrire dans le worktree (fichiers générés non ignorés…).
      const touched = afterTask(() => changedLines(baseline, statusLines(created.path)));
      checksText =
        formatChecks(results) +
        (touched.length > 0 ? `\nLes vérifications ont modifié des fichiers suivis ou créé des fichiers : ${touched.map((line) => line.trim()).join(", ")}.` : "");
    } else {
      checksText = formatSandboxChecks(sandboxChecks, created.branch);
    }

    console.log(
      buildWriteReport({
        lastMessage: response,
        checks: checksText,
        status,
        diffStat: stat,
        worktreePath: created.path,
        branch: created.branch,
        footer: footer(),
        sandboxExitReason: command.sandboxExitReason,
        ignored: changes.ignored,
        priority: priorityReviewFiles(changes),
        canariesReset,
      }),
    );
    return 0;
  } catch (error) {
    // Une ALERTE garde le dossier brut comme preuve : rien n'y est supprimé ni lu par git.
    if (error instanceof TamperedWorkError) keepWork = true;
    // Entre la réussite de Codex et le worktree, tout échec garderait un travail perdu : on le garde.
    if (unreported) {
      keepWork = true;
      if (!(error instanceof TamperedWorkError)) {
        const reason = (error instanceof Error ? error.message : String(error)).split("\n")[0];
        console.error(`Le travail de Codex n'a pas été reporté (${reason}) : dossier work conservé.`);
      }
    }
    if (worktree) {
      console.error(`Worktree conservé : ${worktree.path} (branche ${worktree.branch}). Nettoyage : bun scripts/codex/run.ts clean ${worktree.branch}`);
    }
    throw error;
  } finally {
    interrupts.dispose();
    if (tempDir !== null) rmSync(tempDir, { recursive: true, force: true, maxRetries: 3 });
    if (work) {
      if (keepWork) console.error(`Dossier work conservé : ${work.dir} (src/${existsSync(work.base) ? " et base/" : ""}). ${cleanWorkHint(work)}`);
      else {
        try {
          removeDir(work.dir);
        } catch (removeError) {
          console.error(`Suppression de ${work.dir} impossible (${removeError instanceof Error ? removeError.message : String(removeError)}). ${cleanWorkHint(work)}`);
        }
      }
      reportCallerChanges(root, before);
    }
  }
}
