import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { safeEnv } from "./codex";
import { UnavailableError } from "./errors";

/**
 * Copie expurgée du dépôt : Codex lit le disque entier (le bac à sable ne bloque que l'écriture),
 * donc il ne reçoit qu'une copie sans secrets ni `.git`, et jamais le chemin du vrai dépôt.
 */

// `.env.example` est versionné et ne contient pas de secret.
const SECRET_FILE = /^(\.env.*|.+\.(pem|key|p12|pfx)|id_(rsa|ed25519|ecdsa).*)$/i;
const ALLOWED_SECRET_LOOKALIKE = /^\.env\.example$/i;

/** Vrai si le chemin (relatif, `/` ou `\`) ne doit jamais être copié. */
export function isSensitivePath(relativePath: string): boolean {
  const segments = relativePath.split(/[\\/]/).filter(Boolean);
  return segments.some((segment) => {
    // Windows ignore le point et l'espace finaux, et lit les flux NTFS (`.env::$DATA`) :
    // on teste le nom nettoyé.
    const name = segment.replace(/:.*$/, "").replace(/[. ]+$/, "");
    if (name.toLowerCase() === ".git") return true;
    return SECRET_FILE.test(name) && !ALLOWED_SECRET_LOOKALIKE.test(name);
  });
}

/**
 * Pathspecs git qui retirent d'un diff les fichiers sensibles : leur contenu ne doit pas
 * passer dans `CODEX_CONTEXT.md` alors que la copie ne les contient pas. `literal` évite
 * qu'un nom contenant `*` ou `[` soit interprété comme un motif.
 */
export function sensitiveExcludes(paths: readonly string[]): string[] {
  return paths.filter(isSensitivePath).map((file) => `:(exclude,literal)${file}`);
}

// Une config de dépôt ne doit pas pouvoir lancer de programme : ni démon fsmonitor, ni hooks, et git
// ne descend pas dans les sous-modules. Git ne tourne jamais sur un dossier où Codex a écrit.
const NULL_DEVICE = process.platform === "win32" ? "NUL" : "/dev/null";
export const GIT_HARDENING = [
  "-c", "core.fsmonitor=false",
  "-c", `core.hooksPath=${NULL_DEVICE}`,
  "-c", "diff.ignoreSubmodules=all",
  "-c", "submodule.recurse=false",
];

/**
 * Lance git sans jamais lever. Toutes les commandes passent par ici : options durcies et
 * environnement filtré (`safeEnv`).
 */
export function gitRaw(root: string, args: readonly string[], input?: string): SpawnSyncReturns<string> {
  return spawnSync("git", [...GIT_HARDENING, ...args], {
    cwd: root,
    env: safeEnv(),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    input,
  });
}

/**
 * Sortie de git ; un échec lève `ErrorClass` : `UnavailableError` par défaut (git est en panne), `UsageError` seulement
 * là où une référence vient de l'appelant (`--base`, `--from`, `--branch`, dossier courant hors d'un dépôt).
 */
export function git(root: string, args: string[], ErrorClass: new (message: string) => Error = UnavailableError): string {
  const result = gitRaw(root, args);
  if (result.status !== 0) {
    throw new ErrorClass(`git ${args.join(" ")} : ${result.stderr?.trim() || result.error?.message}`);
  }
  return result.stdout;
}

/** Fichiers suivis ou non suivis et non ignorés (donc ni `.env*`, ni `.git`, ni `node_modules`). */
export function listRepoFiles(root: string): string[] {
  return git(root, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"]).split("\0").filter(Boolean);
}

/** Dossier de la documentation Next.js installée, relatif à la racine du dépôt. */
export const NEXT_DOCS_DIR = path.join("node_modules", "next", "dist", "docs");

/**
 * Documentation Next.js installée : ignorée par git, mais Codex doit pouvoir la lire. Les chemins
 * sont relatifs à `NEXT_DOCS_DIR` : `node_modules` peut être un lien vers un cache hors du dépôt,
 * donc la copie prend le dossier des docs comme racine, pas le dépôt.
 */
export function listNextDocs(root: string): string[] {
  const docsDir = path.join(root, NEXT_DOCS_DIR);
  if (!existsSync(docsDir)) return [];
  return readdirSync(docsDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(docsDir, path.join(entry.parentPath, entry.name)).replaceAll("\\", "/"));
}

export type SnapshotResult = { copied: number; skipped: string[] };

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/**
 * Copie `files` (chemins relatifs à `root`) vers `dest`. Saute les fichiers sensibles, les
 * fichiers listés mais supprimés, et tout ce qui n'est pas un fichier ordinaire ou dont le
 * chemin réel sort de `root` : un lien symbolique, ou une jonction dans un dossier parent,
 * pourrait pointer hors du dépôt.
 */
export function copySnapshot(root: string, files: readonly string[], dest: string): SnapshotResult {
  const result: SnapshotResult = { copied: 0, skipped: [] };
  if (files.length === 0) return result;
  const realRoot = realpathSync.native(root);
  const destRoot = path.resolve(dest);
  for (const file of files) {
    const source = path.join(root, file);
    const target = path.resolve(destRoot, file);
    if (isSensitivePath(file) || !isInside(destRoot, target)) {
      result.skipped.push(file);
      continue;
    }
    let isRegularFile: boolean;
    let realSource: string;
    try {
      isRegularFile = lstatSync(source).isFile();
      realSource = realpathSync.native(source);
    } catch {
      continue; // Listé par git mais supprimé de l'arbre de travail.
    }
    if (!isRegularFile || !isInside(realRoot, realSource)) {
      result.skipped.push(file);
      continue;
    }
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(source, target);
    result.copied += 1;
  }
  return result;
}
