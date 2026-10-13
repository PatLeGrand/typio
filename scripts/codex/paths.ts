import { mkdirSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Tout l'état du wrapper vit sous `~/.typio-codex/`, hors de `%TEMP%` (que le mode `workspace-write`
 * de Codex peut autoriser en écriture) :
 *   state/      caches des canaris, dossiers temporaires des tâches d'écriture ;
 *   read/       copies expurgées des tâches de lecture ;
 *   canary/     dossiers jetables des canaris d'écriture ;
 *   work/       dossiers bruts des tâches d'écriture (`<id>/base`, `<id>/src`) : Codex n'écrit que là,
 *               jamais dans un dépôt git ;
 *   worktrees/  worktrees des tâches d'écriture, créés après Codex pour recevoir ses changements.
 */

export function typioCodexHome(): string {
  return path.join(os.homedir(), ".typio-codex");
}

export const stateDir = (): string => path.join(typioCodexHome(), "state");
export const readDir = (): string => path.join(typioCodexHome(), "read");
export const canaryDir = (): string => path.join(typioCodexHome(), "canary");
export const workDir = (): string => path.join(typioCodexHome(), "work");
export const worktreesDir = (): string => path.join(typioCodexHome(), "worktrees");

/** Crée `parent` s'il manque, puis un sous-dossier jetable `<prefixe>XXXXXX` dedans. */
export function makeScratchDir(parent: string, prefix: string): string {
  mkdirSync(parent, { recursive: true });
  return mkdtempSync(path.join(parent, prefix));
}

/** Identifiant d'un dossier `work/<id>` : un nom simple, sans séparateur. Une seule définition (cli et workdir). */
export const WORK_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
