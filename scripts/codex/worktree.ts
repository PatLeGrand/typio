import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { UnavailableError, UsageError } from "./errors";
import { worktreesDir } from "./paths";
import { git, gitRaw } from "./snapshot";

/**
 * Worktrees des tâches d'écriture : un par tâche, créé par le wrapper sous `~/.typio-codex/worktrees/`,
 * sur une branche `codex/*`, **après** Codex : il n'y a jamais écrit, il reçoit seulement ses changements
 * (voir `apply.ts`). Une branche créée ici porte un marqueur de configuration : `clean` ne supprime que
 * ce que le wrapper a créé, jamais une branche `codex/*` venue d'ailleurs (l'app desktop Codex en crée
 * aussi), et retrouve le worktree par `git worktree list`, pas par le chemin.
 */

export const BRANCH_PREFIX = "codex/";
const OWNER_KEY = "typiocodex";

export type Worktree = {
  path: string;
  branch: string;
  /** Commit de départ : tout ce qui change ensuite vient de Codex. */
  startCommit: string;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** `codex/<tâche>-AAAAMMJJ-HHMMSS`, en heure locale. */
export function defaultBranchName(task: string, now: Date = new Date()): string {
  const day = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${BRANCH_PREFIX}${task}-${day}-${time}`;
}

/** Le préfixe `codex/` est la condition de `clean` : une branche qui ne l'a pas ne serait pas nettoyable. */
export function validateBranchName(branch: string): void {
  if (branch.startsWith("-")) throw new UsageError(`Nom de branche invalide : ${branch} (commence par « - »).`);
  if (!branch.startsWith(BRANCH_PREFIX) || branch.length === BRANCH_PREFIX.length) {
    throw new UsageError(`La branche doit commencer par ${BRANCH_PREFIX} (reçu : ${branch}).`);
  }
  if (!/^[A-Za-z0-9._/-]+$/.test(branch) || branch.includes("..") || branch.endsWith("/") || branch.endsWith(".lock")) {
    throw new UsageError(`Nom de branche invalide : ${branch}.`);
  }
}

/**
 * Racine des worktrees : `%USERPROFILE%\.typio-codex\worktrees`, hors du dépôt. Le bac à sable
 * Windows « unelevated » accepte un dossier de travail sous le dossier personnel, et Codex n'a
 * plus le `.env.local` du dépôt à côté de lui.
 */
export function defaultWorktreesRoot(): string {
  return worktreesDir();
}

/** `<racine>/codex-<branche sans préfixe, aplatie>`. */
export function worktreePath(branch: string, root: string = defaultWorktreesRoot()): string {
  const flat = branch.slice(BRANCH_PREFIX.length).replace(/[^A-Za-z0-9._-]+/g, "-");
  return path.join(root, `codex-${flat}`);
}

/** `git status --porcelain`, fichiers non suivis un par un. Une ligne par chemin. */
export function statusLines(cwd: string): string[] {
  return git(cwd, ["status", "--porcelain", "--untracked-files=all"]).split(/\r?\n/).filter(Boolean);
}

/** Lignes présentes dans un seul des deux états : ce qui a changé entre `before` et `after`. */
export function changedLines(before: readonly string[], after: readonly string[]): string[] {
  const left = new Set(before);
  const right = new Set(after);
  return [...before.filter((line) => !right.has(line)), ...after.filter((line) => !left.has(line))];
}

/**
 * Contrôles faits avant toute chose, en erreur d'usage (code 1) : nom de branche valide pour git,
 * branche libre, point de départ existant. Renvoie le commit de départ, résolu une fois pour toutes.
 */
export function preflightWorktree(cwd: string, branch: string, from: string): string {
  validateBranchName(branch);
  if (from.startsWith("-")) throw new UsageError(`--from invalide : ${from} (commence par « - »).`);
  const format = gitRaw(cwd, ["check-ref-format", "--branch", branch]);
  if (format.status !== 0) throw new UsageError(`Nom de branche refusé par git : ${branch}.`);
  if (gitRaw(cwd, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]).status === 0) {
    throw new UsageError(`La branche ${branch} existe déjà.`);
  }
  const resolved = gitRaw(cwd, ["rev-parse", "--verify", "--end-of-options", `${from}^{commit}`]);
  if (resolved.status !== 0) throw new UsageError(`--from ${from} n'est pas un commit connu.`);
  return resolved.stdout.trim();
}

function gitUnavailable(cwd: string, args: string[]): string {
  return git(cwd, args, UnavailableError);
}

/**
 * Crée le worktree et sa branche, avec le marqueur de propriété. Si une étape échoue après
 * `worktree add`, le worktree et la branche sont défaits : rien ne traîne sans marqueur.
 * `from` est un commit déjà résolu par `preflightWorktree`.
 */
export function createWorktree(cwd: string, branch: string, from: string, root: string = defaultWorktreesRoot()): Worktree {
  validateBranchName(branch);
  const target = worktreePath(branch, root);
  if (existsSync(target)) throw new UnavailableError(`le dossier ${target} existe déjà.`);
  gitUnavailable(cwd, ["worktree", "add", "--no-track", "-b", branch, target, from]);
  try {
    gitUnavailable(cwd, ["config", "--local", `branch.${branch}.${OWNER_KEY}`, "true"]);
    const startCommit = gitUnavailable(target, ["rev-parse", "HEAD"]).trim();
    return { path: target, branch, startCommit };
  } catch (error) {
    gitRaw(cwd, ["worktree", "remove", "--force", target]);
    gitRaw(cwd, ["branch", "-D", branch]);
    throw error instanceof UnavailableError ? error : new UnavailableError(error instanceof Error ? error.message : String(error));
  }
}

function ownedByWrapper(cwd: string, branch: string): boolean {
  const result = gitRaw(cwd, ["config", "--local", "--get", `branch.${branch}.${OWNER_KEY}`]);
  return result.status === 0 && result.stdout.trim() === "true";
}

/** Chemin du worktree enregistré pour `branch`, s'il existe. */
function registeredWorktree(cwd: string, branch: string): string | null {
  const entries = git(cwd, ["worktree", "list", "--porcelain"]).split(/\r?\n\r?\n/);
  for (const entry of entries) {
    const lines = entry.split(/\r?\n/);
    if (lines.includes(`branch refs/heads/${branch}`)) {
      const line = lines.find((candidate) => candidate.startsWith("worktree "));
      return line ? line.slice("worktree ".length) : null;
    }
  }
  return null;
}

function isUnder(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

/** Chemin réel s'il existe, sinon chemin normalisé : un worktree supprimé à la main reste jugeable. */
function realOrResolved(target: string): string {
  return existsSync(target) ? realpathSync.native(target) : path.resolve(target);
}

/**
 * Garde-fous de `clean` et `verify` : branche `codex/*` qui existe, marquée par le wrapper, et dont le
 * worktree (s'il existe) a son chemin réel sous `root`. Renvoie le chemin du worktree enregistré.
 */
function checkOwnedBranch(cwd: string, branch: string, root: string): string | null {
  if (!branch.startsWith(BRANCH_PREFIX)) throw new UsageError(`Seules les branches ${BRANCH_PREFIX}* sont acceptées (reçu : ${branch}).`);
  validateBranchName(branch);
  const exists = gitRaw(cwd, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]).status === 0;
  if (!exists) throw new UsageError(`La branche ${branch} n'existe pas.`);
  if (!ownedByWrapper(cwd, branch)) {
    throw new UsageError(`La branche ${branch} n'a pas été créée par ce wrapper : à traiter à la main si c'est voulu.`);
  }
  const worktree = registeredWorktree(cwd, branch);
  if (worktree && !isUnder(realOrResolved(root), realOrResolved(worktree))) {
    throw new UsageError(`Le worktree de ${branch} (${worktree}) n'est pas sous ${root} : rien n'a été fait.`);
  }
  return worktree;
}

/** Retrouve le worktree d'une branche du wrapper pour `verify`. Mêmes garde-fous que `clean`. */
export function openOwnedWorktree(cwd: string, branch: string, root: string = defaultWorktreesRoot()): string {
  const worktree = checkOwnedBranch(cwd, branch, root);
  if (!worktree || !existsSync(worktree)) throw new UsageError(`La branche ${branch} n'a plus de worktree.`);
  return worktree;
}

/**
 * Supprime le worktree puis la branche créés par le wrapper. Refuse (code 1) toute branche hors
 * `codex/*`, inconnue, ou qui n'a pas été créée par le wrapper, et tout worktree dont le chemin
 * réel n'est pas sous `root`. Renvoie ce qui a été supprimé.
 */
export function cleanBranch(cwd: string, branch: string, root: string = defaultWorktreesRoot()): string[] {
  const worktree = checkOwnedBranch(cwd, branch, root);
  const removed: string[] = [];
  if (worktree) {
    git(cwd, ["worktree", "remove", "--force", worktree]);
    removed.push(`worktree ${worktree}`);
  }
  git(cwd, ["branch", "-D", branch]);
  removed.push(`branche ${branch}`);
  return removed;
}

/**
 * `git diff --stat` contre le commit de départ. Les fichiers non suivis n'y figurent pas (pas de
 * `git add -N` : le wrapper ne modifie pas l'index) ; le rapport les ajoute (`summarizeAdded`).
 */
export function diffStat(worktree: Worktree): string {
  return git(worktree.path, ["diff", "--no-ext-diff", "--no-textconv", "-a", "--stat", worktree.startCommit], UnavailableError);
}
