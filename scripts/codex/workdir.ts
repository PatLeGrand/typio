import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import path from "node:path";
import { collectChanges, hasChanges, type IgnoreCheck } from "./collect";
import { safeEnv } from "./codex";
import { TamperedWorkError, UnavailableError, UsageError } from "./errors";
import { makeScratchDir, WORK_ID, workDir } from "./paths";
import { GIT_HARDENING } from "./snapshot";

/**
 * Dossier brut d'une tâche d'écriture : `~/.typio-codex/work/<id>/` avec `src/` (extraction du commit
 * de départ, où Codex travaille) puis `base/` (même commit, extraite de nouveau APRÈS Codex, juste avant
 * la comparaison : Codex, même sans bac à sable, ne peut jamais altérer la référence). Ni l'un ni l'autre
 * n'a de `.git` : Codex n'écrit jamais dans un dépôt git, et le wrapper ne lance jamais git dans `src`.
 * Le commit est résolu une fois pour toutes au pré-contrôle et réutilisé ici.
 */

export type Workdir = { id: string; dir: string; base: string; src: string };

/** Une exécution de `git archive` du commit, extraite dans chaque dossier de `destinations` (un seul, en pratique). */
export function extractCommit(root: string, commit: string, destinations: readonly string[]): void {
  const archive = spawnSync("git", [...GIT_HARDENING, "archive", "--format=tar", commit], {
    cwd: root,
    env: safeEnv(),
    maxBuffer: 1024 * 1024 * 1024,
  });
  if (archive.status !== 0 || !Buffer.isBuffer(archive.stdout)) {
    throw new UnavailableError(`git archive ${commit} : ${archive.stderr?.toString().trim() || archive.error?.message || `code ${archive.status}`}`);
  }
  for (const dest of destinations) {
    mkdirSync(dest, { recursive: true });
    // Le dossier de destination est le dossier courant de tar, jamais un argument : GNU tar prend
    // `C:\…` pour un hôte distant. L'archive arrive sur l'entrée standard.
    const extract = spawnSync("tar", ["-xf", "-"], { cwd: dest, env: safeEnv(), input: archive.stdout, maxBuffer: 16 * 1024 * 1024 });
    if (extract.status !== 0) {
      throw new UnavailableError(`tar -xf a échoué dans ${dest} : ${extract.stderr?.toString().trim() || extract.error?.message || `code ${extract.status}`}`);
    }
  }
}

/** Crée `work/<id>/src` depuis `commit` (pas encore `base`). En cas d'échec, le dossier créé est supprimé. */
export function prepareWorkdir(root: string, commit: string, parent: string = workDir()): Workdir {
  const dir = realpathSync.native(makeScratchDir(parent, "run-"));
  const work: Workdir = { id: path.basename(dir), dir, base: path.join(dir, "base"), src: path.join(dir, "src") };
  try {
    extractCommit(root, commit, [work.src]);
    return work;
  } catch (error) {
    removeDir(dir);
    throw error;
  }
}

/**
 * Extrait la référence `base/` du même commit, après Codex. Un `base/` déjà présent (Codex n'y a pas
 * accès, mais on ne s'y fie pas) est supprimé d'abord.
 */
export function extractBase(root: string, commit: string, work: Workdir): void {
  removeDir(work.base);
  extractCommit(root, commit, [work.base]);
}

export type FailedWorkVerdict = { keep: boolean; reason: string };

/**
 * Après un échec de Codex (délai, réponse vide, erreur) : le travail partiel vaut-il d'être gardé ? Oui si
 * `src` a au moins un changement par rapport au commit de départ, ou si on ne peut pas le savoir. Un
 * `TamperedWorkError` (travail piégé) remonte tel quel : l'ALERTE s'applique.
 */
export function judgeFailedWork(root: string, commit: string, work: Workdir, isIgnored: IgnoreCheck): FailedWorkVerdict {
  try {
    extractBase(root, commit, work);
    const changes = collectChanges(work.base, work.src, isIgnored);
    return hasChanges(changes)
      ? { keep: true, reason: "src contient des changements" }
      : { keep: false, reason: "Codex n'a rien changé" };
  } catch (error) {
    if (error instanceof TamperedWorkError) throw error;
    return { keep: true, reason: `impossible de savoir si src a changé (${error instanceof Error ? error.message : String(error)})` };
  }
}

/** Suppression qui ne suit jamais un lien (une jonction posée par Codex est retirée, pas parcourue). */
export function removeDir(dir: string): void {
  // Windows peut garder un fichier verrouillé un instant après la fin de Codex.
  rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
}

/**
 * `clean --work <id>` : supprime un dossier `work` gardé (`--keep` ou ALERTE), et seulement lui. L'identifiant
 * est un nom simple, et le chemin réel du dossier doit être directement sous `parent`.
 */
export function cleanWorkdir(id: string, parent: string = workDir()): string {
  if (!WORK_ID.test(id) || id.includes("..")) throw new UsageError(`Identifiant de dossier work invalide : ${id}.`);
  const target = path.join(parent, id);
  if (!existsSync(parent)) throw new UsageError(`Aucun dossier work : ${id}.`);
  let stat;
  try {
    stat = lstatSync(target);
  } catch {
    throw new UsageError(`Aucun dossier work : ${id}.`);
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new UsageError(`${id} n'est pas un dossier work du wrapper.`);
  const realParent = realpathSync.native(parent);
  if (path.dirname(realpathSync.native(target)) !== realParent) {
    throw new UsageError(`${id} n'est pas directement sous ${realParent} : rien n'a été supprimé.`);
  }
  removeDir(target);
  return target;
}
