import { rmSync } from "node:fs";
import { safeEnv } from "./codex";
import { makeScratchDir, stateDir } from "./paths";

/**
 * Commandes lancées dans le bac à sable de Codex (`codex sandbox -P :workspace`) : le lint de `src`
 * et le canari de ce bac à sable. Mêmes arguments et même environnement pour les deux, donc le
 * canari prouve ce que le lint utilise vraiment.
 */

/**
 * Écriture limitée au dossier `cwd`, réseau coupé. `windows.sandbox="unelevated"` : même choix que
 * `codex exec` (voir `buildCodexArgs`).
 */
export function sandboxCommandArgs(cwd: string, command: readonly string[]): string[] {
  return [
    "sandbox", "-P", ":workspace", "-C", cwd,
    "-c", 'windows.sandbox="unelevated"',
    "-c", "sandbox_workspace_write.network_access=false",
    "--", ...command,
  ];
}

/**
 * `CODEX_HOME` jetable, créé puis supprimé à chaque exécution : pas de config utilisateur ni d'état
 * partagé d'une exécution à l'autre. Il est sous `state/`, hors du dossier de travail.
 */
export function withDisposableCodexHome<T>(action: (home: string) => T, parent: string = stateDir()): T {
  const home = makeScratchDir(parent, "codex-home-");
  try {
    return action(home);
  } finally {
    rmSync(home, { recursive: true, force: true, maxRetries: 3 });
  }
}

/** `safeEnv` (sans `DATABASE_URL` ni secret), `CODEX_HOME` jetable, plus des variables propres au canari. */
export function sandboxEnv(home: string, extra: Readonly<Record<string, string>> = {}): NodeJS.ProcessEnv {
  return { ...safeEnv(), ...extra, CODEX_HOME: home };
}
