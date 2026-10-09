import { spawnSync } from "node:child_process";
import { checkEnv } from "./codex";
import { UsageError } from "./errors";
import { sandboxCommandArgs, sandboxEnv, withDisposableCodexHome } from "./sandbox";

/**
 * Vérifications lancées par le wrapper lui-même après Codex, hors bac à sable pour `verify` et pour
 * `--sortie-bac-a-sable` (dans le worktree, avec l'environnement filtré de `checkEnv` : elles exécutent
 * du code écrit par Codex), dans le bac à sable de Codex pour le lint de `src`.
 * On ne s'en remet jamais au compte rendu de Codex pour savoir si lint, tests et build passent.
 */

export const DEFAULT_CHECKS = ["lint", "test", "build"] as const;
const CHECK_NAME = /^[A-Za-z0-9:_-]+$/;
const CHECK_TIMEOUT_MS = 15 * 60_000;
const TAIL_LINES = 40;

/** Lit `--checks` : une liste de scripts `bun run`, séparés par des virgules, ou `none`. */
export function parseChecks(value: string | undefined): string[] {
  if (value === undefined) return [...DEFAULT_CHECKS];
  if (value.trim() === "none") return [];
  const names = value.split(",").map((name) => name.trim());
  const invalid = names.find((name) => !CHECK_NAME.test(name));
  if (invalid !== undefined) throw new UsageError(`--checks : nom de script invalide « ${invalid} » (attendu : lint,test,build ou none).`);
  return [...new Set(names)];
}

export type CheckResult = {
  name: string;
  /** Code de sortie réel ; `null` si le processus n'a pas pu finir (délai, lancement impossible). */
  exitCode: number | null;
  seconds: number;
  output: string;
  /** Explication quand `exitCode` est `null`. */
  problem?: string;
};

export type CheckExecutor = (name: string, cwd: string) => Omit<CheckResult, "name" | "seconds">;

/**
 * Lance un programme et rend son code de sortie réel. Un délai ou un lancement impossible donne un
 * code `null` et une explication, jamais un faux succès.
 */
export function spawnCheck(
  bin: string,
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number = CHECK_TIMEOUT_MS,
): Omit<CheckResult, "name" | "seconds"> {
  const result = spawnSync(bin, [...args], {
    cwd,
    env,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    timeout: timeoutMs,
    windowsHide: true,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.error) {
    const timedOut = (result.error as NodeJS.ErrnoException).code === "ETIMEDOUT";
    return { exitCode: null, output, problem: timedOut ? `délai de ${Math.round((timeoutMs / 60_000) * 100) / 100} min dépassé` : result.error.message };
  }
  return { exitCode: result.status, output, ...(result.status === null ? { problem: `arrêté par le signal ${result.signal}` } : {}) };
}

// `process.execPath` est le bun qui fait tourner le wrapper : pas de dépendance au PATH.
function runBunScript(name: string, cwd: string): Omit<CheckResult, "name" | "seconds"> {
  return spawnCheck(process.execPath, ["run", name], cwd, checkEnv());
}

/** Lance toutes les vérifications, même si l'une échoue. */
export function runChecks(names: readonly string[], cwd: string, execute: CheckExecutor = runBunScript): CheckResult[] {
  return names.map((name) => {
    const started = Date.now();
    const outcome = execute(name, cwd);
    return { name, seconds: Math.round((Date.now() - started) / 1000), ...outcome };
  });
}

function tail(output: string): string {
  return output.trimEnd().split(/\r?\n/).slice(-TAIL_LINES).join("\n");
}

function checkLines(results: readonly CheckResult[]): string[] {
  const lines: string[] = [];
  for (const { name, exitCode, seconds, output, problem } of results) {
    const code = exitCode === null ? `sans code de sortie (${problem ?? "inconnu"})` : `code ${exitCode}`;
    lines.push(`- bun run ${name} : ${code}, ${seconds} s`);
    if (exitCode !== 0) lines.push("```", tail(output) || "(aucune sortie)", "```");
  }
  return lines;
}

const failedNames = (results: readonly CheckResult[]): string[] => results.filter(({ exitCode }) => exitCode !== 0).map(({ name }) => name);

/**
 * Section « Vérifications » du rapport : chaque commande avec son code de sortie réel et sa durée,
 * les 40 dernières lignes de celles qui échouent, puis la ligne finale `VERIFICATIONS : …`.
 */
export function formatChecks(results: readonly CheckResult[]): string {
  if (results.length === 0) return "VERIFICATIONS : AUCUNE (désactivées avec --checks none)";
  const failed = failedNames(results);
  return [...checkLines(results), failed.length === 0 ? "VERIFICATIONS : OK" : `VERIFICATIONS : ECHEC (${failed.join(", ")})`].join("\n");
}

/**
 * Vérifications lancées automatiquement dans le bac à sable (seulement `lint`) : ligne
 * `VERIFICATIONS (bac à sable) : lint OK|ECHEC`, puis le rappel de `verify` pour le reste, à lancer
 * après relecture du diff (pas de rappel sans branche : Codex n'a rien changé). Un échec peut venir
 * du bac à sable lui-même : la sortie est donnée telle quelle.
 */
export function formatSandboxChecks(results: readonly CheckResult[], branch: string | null): string {
  const verdict =
    results.length === 0
      ? "VERIFICATIONS (bac à sable) : AUCUNE (désactivées avec --checks none)"
      : `VERIFICATIONS (bac à sable) : ${results.map(({ name, exitCode }) => `${name} ${exitCode === 0 ? "OK" : "ECHEC"}`).join(", ")}`;
  const reminder = branch === null ? [] : [`A LANCER APRÈS RELECTURE : bun scripts/codex/run.ts verify ${branch}`];
  return [...checkLines(results), verdict, ...reminder].join("\n");
}

/** Lanceur de programme de `runSandboxedChecks`, remplaçable dans les tests. */
export type SpawnCheck = typeof spawnCheck;

/**
 * Lance des scripts `bun run` dans le bac à sable de Codex (`codex sandbox -P :workspace`), dans `src` :
 * écriture limitée à ce dossier, réseau coupé, `CODEX_HOME` jetable (créé puis supprimé à chaque
 * exécution), environnement `safeEnv` sans `DATABASE_URL`. Seul `lint` y tourne : `test` (vite lance un
 * processus fils, `spawn EPERM`) et `build` (polices Google, réseau) y sont impossibles sous Windows.
 */
export function runSandboxedChecks(
  bin: string,
  names: readonly string[],
  src: string,
  spawn: SpawnCheck = spawnCheck,
  homeParent?: string,
): CheckResult[] {
  return runChecks(names, src, (name, cwd) =>
    withDisposableCodexHome(
      (home) => spawn(bin, sandboxCommandArgs(cwd, [process.execPath, "run", name]), cwd, sandboxEnv(home)),
      homeParent,
    ),
  );
}

/** `verify` : les trois vérifications habituelles, ou une liste choisie. */
export function parseVerifyChecks(value: string | undefined): string[] {
  const names = parseChecks(value);
  if (names.length === 0) throw new UsageError("verify : rien à vérifier (--checks none n'a pas de sens ici).");
  return names;
}

/**
 * `--checks` de `implement` et `qa` : seul ce qui tourne automatiquement. Dans le bac à sable, `lint` ou
 * `none` ; avec `--sortie-bac-a-sable`, tout est lancé hors bac à sable et la liste est libre.
 */
export function parseAutoChecks(value: string | undefined, sandboxExit: boolean): string[] {
  if (sandboxExit) return parseChecks(value);
  if (value === undefined || value.trim() === "lint") return ["lint"];
  if (value.trim() === "none") return [];
  throw new UsageError(
    `--checks : seuls lint ou none tournent automatiquement (reçu : ${value}). test et build se lancent après relecture : bun scripts/codex/run.ts verify <branche>.`,
  );
}
