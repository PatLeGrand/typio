import path from "node:path";
import type { VerifyCommand } from "./cli";
import { TamperedWorkError } from "./errors";
import { copyExistingModel, type DependencyDeps } from "./deps";
import { installDependencies } from "./install";
import { git } from "./snapshot";
import { formatChecks, runChecks, type CheckExecutor } from "./verify";
import { removeDir } from "./workdir";
import { openOwnedWorktree } from "./worktree";
import { stateDir } from "./paths";

/**
 * `verify <codex/branche>` : lance les vérifications d'un worktree du wrapper, hors bac à sable, avec
 * l'environnement filtré de `checkEnv`. À lancer après avoir relu le diff : ces commandes exécutent du
 * code écrit par Codex. Le worktree est d'abord remis à neuf côté dépendances : `node_modules/` et
 * `.next/` supprimés, puis le modèle de dépendances qui correspond à l'empreinte (package.json, bun.lock, bunfig.toml)
 * est copié s'il existe, sinon `bun install` tourne directement dans le worktree. Verify ne construit jamais de modèle. Avant cela, un fichier ignoré hors de `node_modules/` et `.next/` (caché par un
 * `.gitignore` de Codex, donc absent du diff relu) est une ALERTE : rien n'est exécuté.
 * Code 0 : rapport affiché ; 1 : usage ; 2 : ALERTE ou préparation des dépendances impossible.
 */

/** Ce qui se remplace dans les tests : copie et installation des dépendances, vérifications, racine des worktrees. */
export type VerifyDeps = {
  copyExistingModel?: (cwd: string, stateParent: string, deps?: DependencyDeps) => boolean;
  /** Exécuteurs passés à `copyExistingModel` (robocopy). */
  dependencyDeps?: DependencyDeps;
  installDependencies?: (cwd: string) => void;
  execute?: CheckExecutor;
  worktreesRoot?: string;
  stateParent?: string;
};

const GENERATED_DIRS = ["node_modules", ".next"];
// Écrits par les vérifications elles-mêmes (lint, build) et ignorés par le dépôt : un second `verify` ne doit pas s'alerter.
const GENERATED_FILES = new Set(["tsconfig.tsbuildinfo", "next-env.d.ts"]);

/**
 * Fichiers non suivis et ignorés du worktree, hors `node_modules/` et `.next/` à la racine : ce qu'un
 * `.gitignore` ajouté par Codex cacherait à la relecture du diff. `--directory` regroupe un dossier ignoré
 * en une ligne (sans lister les milliers de fichiers de `node_modules/`).
 */
export function findHiddenFiles(worktreePath: string): string[] {
  const listed = git(worktreePath, ["ls-files", "--others", "--ignored", "--exclude-standard", "--directory", "-z"]);
  return listed
    .split("\0")
    .filter(Boolean)
    .filter((entry) => {
      const name = entry.replace(/\/$/, "");
      return !GENERATED_DIRS.includes(name) && !GENERATED_FILES.has(name);
    });
}

export function runVerify(root: string, command: VerifyCommand, deps: VerifyDeps = {}): number {
  const worktreePath = openOwnedWorktree(root, command.branch, deps.worktreesRoot);
  // Avant de supprimer node_modules/ et .next/ (sans effet sur cette liste) et avant toute exécution.
  const hidden = findHiddenFiles(worktreePath);
  if (hidden.length > 0) {
    const shown = hidden.slice(0, 20).join(", ");
    const more = hidden.length > 20 ? ` … (+${hidden.length - 20})` : "";
    throw new TamperedWorkError(
      `ALERTE : le worktree contient des fichiers ignorés par git hors de node_modules/ et .next/ (un .gitignore de Codex les cache à la relecture du diff) : ${shown}${more}. Rien n'a été exécuté.`,
    );
  }
  for (const name of GENERATED_DIRS) removeDir(path.join(worktreePath, name));
  // Jamais de construction ici : le worktree contient du code de Codex. Sans modèle correspondant, installation
  // directe dans le worktree, et rien n'est écrit sous state/deps/.
  const copied = (deps.copyExistingModel ?? copyExistingModel)(worktreePath, deps.stateParent ?? stateDir(), deps.dependencyDeps);
  if (!copied) (deps.installDependencies ?? installDependencies)(worktreePath);
  console.log(
    `## Vérifications (lancées par verify, hors bac à sable)\n\nWorktree : ${worktreePath}\n\n${formatChecks(runChecks(command.checks, worktreePath, deps.execute))}`,
  );
  return 0;
}
