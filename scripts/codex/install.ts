import { spawnSync } from "node:child_process";
import { safeEnv } from "./codex";
import { UnavailableError } from "./errors";

/**
 * Installation des dépendances d'une copie de travail ou d'un worktree. Hors bac à sable, avec le
 * réseau mais sans `DATABASE_URL` ni secret (`safeEnv`).
 * `--backend=copyfile` : par défaut Bun fait des liens physiques vers son cache et vers d'autres
 * `node_modules`, et une écriture dans ce dossier contaminerait ces fichiers partagés.
 */

const INSTALL_TIMEOUT_MS = 10 * 60_000;
export const INSTALL_ARGS = ["install", "--frozen-lockfile", "--backend=copyfile"] as const;

/** Lance `bun install` ; le code de sortie réel et la fin de la sortie sont rendus, rien ne lève. */
export type InstallRunner = (cwd: string) => { status: number | null; output: string; error?: string };

function spawnInstall(cwd: string): ReturnType<InstallRunner> {
  const result = spawnSync(process.execPath, [...INSTALL_ARGS], {
    cwd,
    env: safeEnv(),
    encoding: "utf8",
    timeout: INSTALL_TIMEOUT_MS,
    windowsHide: true,
  });
  return { status: result.status, output: `${result.stdout ?? ""}${result.stderr ?? ""}`, error: result.error?.message };
}

/** `bun install --frozen-lockfile --backend=copyfile` dans `cwd`. Un échec est un Codex indisponible (code 2). */
export function installDependencies(cwd: string, run: InstallRunner = spawnInstall): void {
  console.error(`Installation des dépendances dans ${cwd} (bun install --frozen-lockfile --backend=copyfile)…`);
  const started = Date.now();
  const result = run(cwd);
  if (result.status !== 0) {
    const output = result.output.trimEnd().split(/\r?\n/).slice(-10).join("\n");
    throw new UnavailableError(`bun install a échoué (${result.error ?? `code ${result.status}`}) :\n${output}`);
  }
  console.error(`Dépendances installées en ${Math.round((Date.now() - started) / 1000)} s.`);
}
