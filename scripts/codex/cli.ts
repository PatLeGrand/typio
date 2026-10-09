import { realpathSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { type Effort, parseEffort } from "./codex";
import { UsageError } from "./errors";
import { DEFAULT_QUOTA_THRESHOLD } from "./limits";
import { WORK_ID } from "./paths";
import { isSensitivePath } from "./snapshot";
import { type Level, parseLevel, TASKS, type TaskName, type WriteTaskName } from "./tasks";
import { parseAutoChecks, parseVerifyChecks } from "./verify";
import { BRANCH_PREFIX, validateBranchName } from "./worktree";

/**
 * Ligne de commande de `run.ts`, lue sans effet de bord : toute erreur est une `UsageError`
 * (code 1), jamais un Codex indisponible. Testée dans `cli.test.ts`.
 */

const WRITE_TASK_NAMES = ["implement", "qa"] as const;

export const USAGE = `Usage :
  bun scripts/codex/run.ts <${Object.keys(TASKS).join("|")}> [options] "<consigne>"
  bun scripts/codex/run.ts implement --level <1|2|4> --brief <fichier.md> [options]
  bun scripts/codex/run.ts qa --brief <fichier.md> [options]
  bun scripts/codex/run.ts verify <branche codex/*> [--checks lint,test,build]
  bun scripts/codex/run.ts clean <branche codex/*>
  bun scripts/codex/run.ts clean --work <id>
  bun scripts/codex/run.ts clean --deps
Options communes :
  --model <id>          impose un modèle (sinon celui du tableau tâche/niveau)
  --effort <niveau>     impose l'effort (low, medium, high, xhigh, max)
  --seuil-quota <pct>   renonce à Codex si une limite ChatGPT atteint ce pourcentage (défaut ${DEFAULT_QUOTA_THRESHOLD})
  --keep                lecture : conserve la copie ; écriture : conserve le dossier work/<id> (sinon supprimé, sauf après une ALERTE)
Lecture (search, review, tests, ui) :
  --base <ref>          base du diff (review, tests, ui) ; défaut : origin/develop
Écriture (implement, qa) :
  --level <1|2|4>       implement seulement : 1 mécanique, 2 simple et cadré, 4 difficile (le niveau 3, c'est Sonnet)
  --brief <fichier.md>  brief de la tâche, inclus tel quel dans le prompt
  --from <ref>          point de départ de la copie de travail et du worktree (défaut : HEAD)
  --branch <codex/nom>  branche du worktree (défaut : codex/<tâche>-<date>-<heure>)
  --checks <liste>      implement/qa : none (défaut) ou lint (dans le bac à sable) ; avec --sortie-bac-a-sable : lint,test,build (défaut) ou none
                        verify : lint,test,build (défaut), hors bac à sable, après relecture du diff
  --sortie-bac-a-sable "<raison>"
                        lève le bac à sable (danger-full-access) ; à n'utiliser qu'avec l'accord de l'utilisateur`;

type Common = { model?: string; effort?: Effort; quotaThreshold: number; keep: boolean };

export type ReadCommand = Common & { kind: "read"; task: TaskName; instruction: string; base?: string };

export type WriteCommand = Common & {
  kind: "write";
  task: WriteTaskName;
  level?: Level;
  briefPath: string;
  from: string;
  branch?: string;
  checks: string[];
  /** Raison donnée à `--sortie-bac-a-sable` ; absente si le bac à sable est conservé. */
  sandboxExitReason?: string;
};

export type CleanCommand = { kind: "clean"; branch: string };

/** `clean --work <id>` : supprime un dossier `~/.typio-codex/work/<id>` gardé (`--keep` ou ALERTE). */
export type CleanWorkCommand = { kind: "cleanWork"; id: string };
export type CleanDepsCommand = { kind: "cleanDeps" };

export type VerifyCommand = { kind: "verify"; branch: string; checks: string[] };

export type Command = ReadCommand | WriteCommand | CleanCommand | CleanWorkCommand | CleanDepsCommand | VerifyCommand;

function parseThreshold(value: string | undefined): number {
  if (value === undefined) return DEFAULT_QUOTA_THRESHOLD;
  const threshold = Number(value);
  if (value.trim() === "" || !Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
    throw new UsageError(`--seuil-quota : un pourcentage entre 0 et 100 est attendu (reçu : ${value}).`);
  }
  return threshold;
}

const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Le brief part tel quel chez ChatGPT : jamais un `.env`, une clé ou un fichier du même genre. On
 * regarde tous les segments du chemin donné et du chemin réel (`.env/brief.md`, lien vers `.env.local`).
 */
function isSensitiveBrief(brief: string): boolean {
  let real = path.resolve(brief);
  try {
    real = realpathSync.native(brief);
  } catch {
    // Brief absent : le chemin résolu suffit, `runWrite` refusera le fichier manquant.
  }
  return isSensitivePath(brief) || isSensitivePath(real);
}

/** Une valeur qui commence par « - » serait prise pour une option par git. */
function refuseDash(option: string, value: string | undefined): void {
  if (value?.startsWith("-")) throw new UsageError(`--${option} : la valeur ne peut pas commencer par « - » (reçu : ${value}).`);
}

function isWriteTask(name: string): name is WriteTaskName {
  return (WRITE_TASK_NAMES as readonly string[]).includes(name);
}

export function parseCli(argv: readonly string[]): Command {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        base: { type: "string" },
        model: { type: "string" },
        effort: { type: "string" },
        keep: { type: "boolean", default: false },
        level: { type: "string" },
        brief: { type: "string" },
        from: { type: "string" },
        branch: { type: "string" },
        checks: { type: "string" },
        work: { type: "string" },
        deps: { type: "boolean", default: false },
        "sortie-bac-a-sable": { type: "string" },
        "seuil-quota": { type: "string" },
      },
    });
  } catch (error) {
    // Une option mal tapée ne doit pas passer pour un Codex indisponible.
    throw new UsageError(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`);
  }
  const { values, positionals } = parsed;
  const [taskName, ...rest] = positionals;
  if (!taskName) throw new UsageError(USAGE);

  const used = (names: readonly (keyof typeof values)[]): string[] => names.filter((name) => values[name] !== undefined);

  if (taskName === "verify") {
    const extra = used(["base", "model", "effort", "level", "brief", "from", "branch", "work", "sortie-bac-a-sable", "seuil-quota"]);
    if (extra.length > 0 || values.keep || values.deps) throw new UsageError("verify n'accepte que --checks.");
    const [branch, ...surplus] = rest;
    if (!branch || surplus.length > 0) throw new UsageError(`verify demande une seule branche ${BRANCH_PREFIX}*.`);
    if (!branch.startsWith(BRANCH_PREFIX)) throw new UsageError(`verify n'accepte que les branches ${BRANCH_PREFIX}* (reçu : ${branch}).`);
    return { kind: "verify", branch, checks: parseVerifyChecks(values.checks) };
  }

  if (taskName === "clean") {
    const extra = used(["base", "model", "effort", "level", "brief", "from", "branch", "checks", "sortie-bac-a-sable", "seuil-quota"]);
    if (extra.length > 0 || values.keep) throw new UsageError(`clean n'accepte aucune option (reçu : ${[...extra, ...(values.keep ? ["keep"] : [])].map((name) => `--${name}`).join(", ")}).`);
    if (values.deps) {
      if (values.work !== undefined || rest.length > 0) throw new UsageError("clean --deps ne prend ni branche ni autre option.");
      return { kind: "cleanDeps" };
    }
    if (values.work !== undefined) {
      if (rest.length > 0) throw new UsageError("clean --work demande un identifiant, pas de branche.");
      if (!WORK_ID.test(values.work) || values.work.includes("..")) throw new UsageError(`--work : identifiant invalide « ${values.work} » (nom simple, comme run-AbC123).`);
      return { kind: "cleanWork", id: values.work };
    }
    const [branch, ...surplus] = rest;
    if (!branch || surplus.length > 0) throw new UsageError(`clean demande une seule branche ${BRANCH_PREFIX}*.`);
    if (!branch.startsWith(BRANCH_PREFIX)) throw new UsageError(`clean n'accepte que les branches ${BRANCH_PREFIX}* (reçu : ${branch}).`);
    return { kind: "clean", branch };
  }

  if (values.deps) throw new UsageError("--deps ne concerne que clean.");
  if (values.work !== undefined) throw new UsageError("--work ne concerne que clean.");
  refuseDash("base", values.base);
  refuseDash("from", values.from);
  refuseDash("branch", values.branch);
  if (values.model !== undefined && !MODEL_ID.test(values.model)) {
    throw new UsageError(`--model : identifiant invalide « ${values.model} » (lettres, chiffres, « . », « _ » et « - »).`);
  }

  const common: Common = {
    model: values.model,
    effort: values.effort === undefined ? undefined : parseEffort(values.effort),
    quotaThreshold: parseThreshold(values["seuil-quota"]),
    keep: values.keep,
  };

  if (Object.hasOwn(TASKS, taskName)) {
    const writeOnly = used(["level", "brief", "from", "branch", "checks", "sortie-bac-a-sable"]);
    if (writeOnly.length > 0) throw new UsageError(`${writeOnly.map((name) => `--${name}`).join(", ")} ne concerne que implement et qa.`);
    const instruction = rest.join(" ").trim();
    if (TASKS[taskName as TaskName].requiresInstruction && !instruction) throw new UsageError(`La tâche ${taskName} demande une consigne.`);
    return { kind: "read", task: taskName as TaskName, instruction, base: values.base, ...common };
  }

  if (isWriteTask(taskName)) {
    if (values.base !== undefined) throw new UsageError("--base ne concerne que la lecture (review, tests, ui).");
    if (rest.length > 0) throw new UsageError(`${taskName} ne prend pas de consigne : tout passe par --brief.`);
    if (taskName === "qa" && values.level !== undefined) throw new UsageError("qa n'a pas de niveau : --level ne concerne que implement.");
    if (!values.brief) throw new UsageError(`${taskName} demande --brief <fichier.md>.`);
    if (isSensitiveBrief(values.brief)) {
      throw new UsageError(`--brief : ${values.brief} passe par un nom qui ressemble à un secret (.env, clé…) ; il ne partira pas chez ChatGPT.`);
    }

    const reason = values["sortie-bac-a-sable"];
    if (reason !== undefined && reason.trim() === "") {
      throw new UsageError('--sortie-bac-a-sable demande une raison non vide, par exemple --sortie-bac-a-sable "base locale".');
    }
    if (values.branch !== undefined) validateBranchName(values.branch);
    return {
      kind: "write",
      task: taskName,
      level: taskName === "implement" ? parseLevel(values.level) : undefined,
      briefPath: values.brief,
      from: values.from ?? "HEAD",
      branch: values.branch,
      checks: parseAutoChecks(values.checks, reason !== undefined),
      sandboxExitReason: reason?.trim(),
      ...common,
    };
  }

  throw new UsageError(`Tâche inconnue : ${taskName}\n\n${USAGE}`);
}
