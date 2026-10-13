import { applyChanges, summarizeAdded } from "./apply";
import type { Changes } from "./collect";
import { UnavailableError } from "./errors";
import { git } from "./snapshot";
import { cleanBranch, createWorktree, diffStat, type Worktree } from "./worktree";

/**
 * Report des changements de Codex dans un worktree neuf : le worktree est créé maintenant seulement,
 * depuis le même commit que la copie de travail, puis reçoit les fichiers changés. Codex est terminé et
 * n'a jamais vu ce worktree. Git y est durci comme partout (voir `GIT_HARDENING`).
 */

export type Transfer = {
  worktree: Worktree;
  /** `git status --porcelain` du worktree, fichiers non suivis un par un. */
  status: string;
  /** `git diff --stat` des fichiers suivis, puis une ligne par fichier nouveau (voir `summarizeAdded`). */
  stat: string;
};

export type TransferOptions = {
  root: string;
  branch: string;
  startCommit: string;
  /** `work/<id>/src` : d'où viennent les fichiers ajoutés et modifiés. */
  srcDir: string;
  changes: Changes;
  worktreesRoot?: string;
};

/**
 * Crée le worktree, y reporte les changements et relève son état. Si le report échoue, le worktree et
 * sa branche sont défaits (la copie de travail reste la source) et l'erreur est un Codex indisponible.
 */
export function transferToWorktree({ root, branch, startCommit, srcDir, changes, worktreesRoot }: TransferOptions): Transfer {
  const worktree = createWorktree(root, branch, startCommit, worktreesRoot);
  try {
    applyChanges(srcDir, worktree.path, changes);
    const status = git(worktree.path, ["status", "--porcelain", "--untracked-files=all"], UnavailableError);
    const stat = [diffStat(worktree).trimEnd(), summarizeAdded(worktree.path, changes.added)].filter(Boolean).join("\n");
    return { worktree, status, stat };
  } catch (error) {
    try {
      cleanBranch(root, branch, worktreesRoot);
    } catch (cleanError) {
      console.error(`Suppression du worktree incomplet impossible (${cleanError instanceof Error ? cleanError.message : String(cleanError)}) : ${worktree.path}`);
    }
    throw error instanceof UnavailableError ? error : new UnavailableError(error instanceof Error ? error.message : String(error));
  }
}
