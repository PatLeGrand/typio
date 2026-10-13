import { lstatSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { TamperedWorkError, UnavailableError } from "./errors";
import { gitRaw, isSensitivePath } from "./snapshot";

/**
 * Collecte des changements de Codex, en Node pur : `work/<id>/src` est comparé à `work/<id>/base`
 * (extraction intacte du même commit). Aucune commande git ne tourne dans `src` : un dépôt imbriqué
 * (`evil/.git/config` avec un filtre `clean`, un `.gitattributes`…) ferait exécuter du code hors du
 * bac à sable au premier `git diff`. Le seul git de ce module est `check-ignore`, lancé depuis le
 * dépôt principal, sur des chemins relatifs qu'il n'ouvre pas.
 */

/** `node_modules/` et `.next/` à la racine : installés par le wrapper ou générés, jamais reportés. */
const EXCLUDED_ROOT = new Set(["node_modules", ".next"]);

export type Changes = {
  added: string[];
  modified: string[];
  deleted: string[];
  /** Fichiers créés par Codex et ignorés par le `.gitignore` du dépôt principal : listés, pas reportés. */
  ignored: string[];
};

type EntryKind = "file" | "dir" | "link" | "other";
type Entry = { rel: string; full: string; kind: EntryKind };

/**
 * Parcours récursif sans suivre les liens (`lstat` : une jonction Windows est un lien). `node_modules/`
 * et `.next/` sont exclus à la racine seulement. Les chemins relatifs utilisent `/`.
 */
export function listTree(root: string): Entry[] {
  const entries: Entry[] = [];
  const visit = (dir: string, prefix: string): void => {
    for (const name of readdirSync(dir)) {
      const rel = prefix === "" ? name : `${prefix}/${name}`;
      if (prefix === "" && EXCLUDED_ROOT.has(name)) continue;
      const full = path.join(dir, name);
      const stat = lstatSync(full);
      const kind: EntryKind = stat.isSymbolicLink() ? "link" : stat.isDirectory() ? "dir" : stat.isFile() ? "file" : "other";
      entries.push({ rel, full, kind });
      if (kind === "dir") visit(full, rel);
    }
  };
  visit(root, "");
  return entries;
}

/** Nom tel que Windows le lit : sans flux NTFS (`:`), sans point ni espace finaux, sans casse. */
function normalizedName(rel: string): string {
  const name = rel.slice(rel.lastIndexOf("/") + 1);
  return name.replace(/:.*$/, "").replace(/[. ]+$/, "").toLowerCase();
}

/** `.git`, ou son nom court 8.3 (`GIT~1`) : un dossier de ce nom redirigerait git. */
const isGitName = (name: string): boolean => name === ".git" || /^git~\d+$/.test(name);

function refuse(what: string, rel: string): never {
  throw new TamperedWorkError(`ALERTE : le travail de Codex contient ${what} : ${rel}. Aucun git n'a été lancé dessus.`);
}

/**
 * Refuse tout ce qui ne doit pas atterrir dans un dépôt : une entrée `.git` (fichier ou dossier) à
 * n'importe quelle profondeur, un `.gitmodules`, un lien symbolique ou une jonction, une entrée spéciale,
 * un dossier `.codex/` (lu comme configuration de projet par `codex sandbox`), et, si la base est connue,
 * un fichier sensible (`.env.local`, clé…) qu'elle n'a pas. Sans base, seul ce qui ne dépend pas d'elle est jugé.
 */
function scanForTampering(srcEntries: readonly Entry[], baseEntries?: ReadonlyMap<string, Entry>): void {
  for (const entry of srcEntries) {
    const name = normalizedName(entry.rel);
    if (isGitName(name)) refuse("une entrée .git (dépôt git imbriqué ?)", entry.rel);
    if (name === ".gitmodules") refuse("un .gitmodules", entry.rel);
    if (name === ".codex") refuse("un dossier .codex/ (il pourrait être lu comme configuration de projet)", entry.rel);
    if (entry.kind === "other") refuse("une entrée spéciale (ni fichier, ni dossier)", entry.rel);
    if (entry.kind === "link") refuse("un lien symbolique ou une jonction", entry.rel);
    if (baseEntries && isSensitivePath(entry.rel) && !baseEntries.has(entry.rel)) refuse("un fichier sensible nouveau", entry.rel);
  }
}

/**
 * Balayage de `src` seul, sans la base : à lancer juste après Codex, avant le lint dans le bac à sable
 * (`.git`, `.gitmodules`, liens, `.codex/`). `collectChanges` refait ensuite le balayage complet.
 */
export function scanSrc(src: string): void {
  scanForTampering(listTree(src));
}

function indexOf(entries: readonly Entry[]): Map<string, Entry> {
  return new Map(entries.map((entry) => [entry.rel, entry]));
}

function sameContent(left: string, right: string): boolean {
  if (lstatSync(left).size !== lstatSync(right).size) return false;
  return readFileSync(left).equals(readFileSync(right));
}

/** Dit lesquels de `paths` le `.gitignore` du dépôt principal ignore. */
export type IgnoreCheck = (paths: readonly string[]) => Set<string>;

/**
 * `git check-ignore --no-index --stdin -z`, lancé depuis `root` (le dépôt principal, git durci) : les
 * règles sont celles du dépôt de départ, pas celles que Codex aurait pu écrire dans `src`. Les chemins
 * passent par l'entrée standard : git ne les ouvre pas. Code 1 : aucun n'est ignoré.
 */
export function gitIgnoreCheck(root: string, run: typeof gitRaw = gitRaw): IgnoreCheck {
  return (paths) => {
    if (paths.length === 0) return new Set();
    const result = run(root, ["check-ignore", "--no-index", "--stdin", "-z"], `${paths.join("\0")}\0`);
    if (result.status === 1) return new Set();
    if (result.status !== 0) {
      throw new UnavailableError(`git check-ignore : ${result.stderr?.trim() || result.error?.message || `code ${result.status}`}`);
    }
    return new Set(result.stdout.split("\0").filter(Boolean));
  };
}

/**
 * Fichiers ajoutés, modifiés (contenu différent) et supprimés par Codex. Lève `TamperedWorkError` avant
 * toute autre chose si `src` contient ce que `scanForTampering` refuse (balayage complet, base connue).
 *
 * Seuls les fichiers **ajoutés** peuvent être « ignorés » : la base ne contient que des fichiers suivis,
 * et un fichier suivi modifié par Codex est toujours reporté, même si un motif du `.gitignore` le couvre.
 */
export function collectChanges(base: string, src: string, isIgnored: IgnoreCheck): Changes {
  const baseEntries = indexOf(listTree(base));
  const srcList = listTree(src);
  scanForTampering(srcList, baseEntries);

  const srcFiles = srcList.filter((entry) => entry.kind === "file");
  const srcByRel = indexOf(srcFiles);
  const baseFiles = [...baseEntries.values()].filter((entry) => entry.kind === "file");

  const deleted = baseFiles.filter((entry) => !srcByRel.has(entry.rel)).map((entry) => entry.rel);
  const modified: string[] = [];
  const addedAll: string[] = [];
  for (const entry of srcFiles) {
    const original = baseEntries.get(entry.rel);
    if (original?.kind !== "file") addedAll.push(entry.rel);
    else if (!sameContent(original.full, entry.full)) modified.push(entry.rel);
  }

  const ignoredSet = isIgnored(addedAll);
  const sort = (list: string[]): string[] => list.sort();
  return {
    added: sort(addedAll.filter((rel) => !ignoredSet.has(rel))),
    modified: sort(modified),
    deleted: sort(deleted),
    ignored: sort(addedAll.filter((rel) => ignoredSet.has(rel))),
  };
}

export const hasChanges = ({ added, modified, deleted }: Changes): boolean => added.length + modified.length + deleted.length > 0;
