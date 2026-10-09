import { lstatSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Changes } from "./collect";
import { UnavailableError } from "./errors";

/**
 * Report des changements de Codex dans le worktree neuf : seuls les fichiers ajoutés ou modifiés sont
 * copiés depuis `src`, les fichiers supprimés sont supprimés. Codex est terminé et n'a jamais vu ce
 * worktree ; `collectChanges` a déjà refusé liens, `.git` et fichiers sensibles.
 */

/** Un chemin relatif venu de `collectChanges` ne sort jamais du dossier ; on le revérifie quand même. */
function resolveInside(root: string, rel: string): string {
  const target = path.resolve(root, rel);
  const relative = path.relative(root, target);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new UnavailableError(`chemin hors du worktree refusé : ${rel}`);
  }
  return target;
}

/** Aucun dossier parent de `rel`, dans le worktree, ne doit être un lien (un fichier suivi peut en être un). */
function assertNoLinkAbove(root: string, rel: string): void {
  const parts = rel.split("/").slice(0, -1);
  let current = root;
  for (const part of parts) {
    current = path.join(current, part);
    let isLink: boolean;
    try {
      isLink = lstatSync(current).isSymbolicLink();
    } catch {
      return; // Le dossier n'existe pas encore : il sera créé par nous, donc ordinaire.
    }
    if (isLink) throw new UnavailableError(`le worktree contient un lien à ${path.relative(root, current)} : report refusé pour ${rel}.`);
  }
}

/** Supprime les dossiers vides laissés au-dessus d'un fichier supprimé (git ne suit pas les dossiers). */
function removeEmptyParents(root: string, file: string): void {
  let dir = path.dirname(file);
  while (dir !== root && path.relative(root, dir) !== "" && !path.relative(root, dir).startsWith("..")) {
    if (readdirSync(dir).length > 0) return;
    rmdirSync(dir);
    dir = path.dirname(dir);
  }
}

export function applyChanges(srcDir: string, worktreePath: string, changes: Changes): void {
  const root = path.resolve(worktreePath);
  // Les suppressions d'abord : un fichier peut devenir un dossier, ou l'inverse.
  for (const rel of changes.deleted) {
    assertNoLinkAbove(root, rel);
    const target = resolveInside(root, rel);
    rmSync(target, { force: true });
    removeEmptyParents(root, target);
  }
  for (const rel of [...changes.added, ...changes.modified]) {
    assertNoLinkAbove(root, rel);
    const target = resolveInside(root, rel);
    mkdirSync(path.dirname(target), { recursive: true });
    // Le contenu, pas le fichier : `copyFile` emporterait les flux NTFS secondaires (`fichier:flux`).
    writeFileSync(target, readFileSync(resolveInside(path.resolve(srcDir), rel)));
  }
}

/** Nombre de lignes d'un fichier texte (0 pour un fichier vide ; un fichier binaire compte ses sauts de ligne). */
function countLines(file: string): number {
  const content = readFileSync(file, "utf8");
  if (content === "") return 0;
  return content.split("\n").length - (content.endsWith("\n") ? 1 : 0);
}

/**
 * Lignes `chemin | n +` des fichiers ajoutés. Sans `git add -N`, `git diff --stat` ne les voit pas :
 * le rapport les ajoute lui-même, calculées sur la copie du worktree.
 */
export function summarizeAdded(worktreePath: string, added: readonly string[]): string {
  return added
    .map((rel) => ` ${rel} | ${countLines(resolveInside(path.resolve(worktreePath), rel))} + (nouveau, non suivi)`)
    .join("\n");
}
