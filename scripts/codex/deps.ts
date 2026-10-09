import { spawnSync } from "node:child_process";
import {
  cpSync,
  type Dirent,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { type InstallRunner, installDependencies } from "./install";
import { UnavailableError } from "./errors";

const MODEL_HASH = /^[a-f0-9]{64}$/i;
const COMPLETE = ".complet";
const USED = ".utilise";
const STALE_TEMPORARY = /^[a-f0-9]{64}\.tmp-/i;
const STALE_TEMPORARY_MS = 60 * 60_000;
// Un modèle utilisé depuis moins de 30 minutes sert peut-être à une copie en cours : le ménage n'y touche pas.
const RECENTLY_USED_MS = 30 * 60_000;
const RENAME_ATTEMPTS = 3;
const RENAME_DELAY_MS = 500;
// Ce qui décide de ce que `bun install` installe.
const FINGERPRINT_FILES = [
  { name: "package.json", required: true },
  { name: "bun.lock", required: true },
  { name: "bunfig.toml", required: false },
] as const;

export type RobocopyRunner = (source: string, destination: string) => { status: number | null; output: string; error?: string };

/** Exécuteurs remplaçables : les tests ne lancent ni Bun ni robocopy et n'attendent pas entre deux essais. */
export type DependencyDeps = {
  install?: InstallRunner;
  robocopy?: RobocopyRunner;
  /** Renomme le modèle fini (antivirus et indexation le verrouillent parfois sous Windows). */
  rename?: (from: string, to: string) => void;
  /** Attente entre deux essais de renommage, en millisecondes. */
  sleep?: (milliseconds: number) => void;
};

function depsDir(stateParent: string): string {
  return path.join(stateParent, "deps");
}

/** `state/deps` remplacé par un lien ou une jonction : on ne lit ni n'écrit à travers. */
function assertDepsDirNotLink(stateParent: string): void {
  const directory = depsDir(stateParent);
  if (existsSync(directory) && !isDirectoryNotLink(directory)) {
    throw new UnavailableError(`${directory} n'est pas un dossier (lien ou jonction) : modèles de dépendances refusés.`);
  }
}

function modelDir(stateParent: string, hash: string): string {
  return path.join(depsDir(stateParent), hash);
}

function isDirectoryNotLink(candidate: string): boolean {
  try {
    const entry = lstatSync(candidate);
    return entry.isDirectory() && !entry.isSymbolicLink();
  } catch {
    return false;
  }
}

function isComplete(candidate: string): boolean {
  return isDirectoryNotLink(candidate) && existsSync(path.join(candidate, COMPLETE)) && isDirectoryNotLink(path.join(candidate, "node_modules"));
}

function removeModel(candidate: string): void {
  if (!isDirectoryNotLink(candidate)) throw new UnavailableError(`Le modèle de dépendances n'est pas un dossier sûr : ${candidate}`);
  rmSync(candidate, { recursive: true, force: true, maxRetries: 3 });
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sleepSync(milliseconds: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

/** Retire un lien ou une jonction seul : `unlink` ne touche pas à la cible, `rmdir` couvre les jonctions Windows. */
function removeLink(link: string): void {
  try {
    unlinkSync(link);
  } catch {
    rmdirSync(link);
  }
}

/**
 * Supprime une entrée de `state/deps` sans jamais suivre un lien : un lien ou une jonction est retiré seul (avec
 * un avertissement), un dossier ou un fichier l'est entièrement. `lstat` décide avant toute suppression récursive.
 */
function removeEntryWithoutFollowing(candidate: string): void {
  if (lstatSync(candidate).isSymbolicLink()) {
    console.error(`AVERTISSEMENT : ${candidate} est un lien ou une jonction : seul le lien est retiré, sa cible reste intacte.`);
    removeLink(candidate);
    return;
  }
  rmSync(candidate, { recursive: true, force: true, maxRetries: 3 });
}

function runRobocopy(source: string, destination: string): ReturnType<RobocopyRunner> {
  const result = spawnSync("robocopy", [source, destination, "/MIR", "/MT:16", "/XJ", "/R:1", "/W:1", "/NFL", "/NDL", "/NJH", "/NJS", "/NP"], {
    encoding: "utf8",
    windowsHide: true,
  });
  return { status: result.status, output: `${result.stdout ?? ""}${result.stderr ?? ""}`, error: result.error?.message };
}

/**
 * Empreinte d'un modèle : sha256 de `package.json`, `bun.lock` et `bunfig.toml` (s'il existe), chaque fichier
 * précédé de son nom et de sa taille pour qu'une concaténation ne puisse pas en imiter une autre.
 */
export function dependencyHash(projectDir: string): string {
  const hash = createHash("sha256");
  for (const { name, required } of FINGERPRINT_FILES) {
    const file = path.join(projectDir, name);
    if (!existsSync(file)) {
      if (required) throw new UnavailableError(`${name} est absent de ${projectDir}.`);
      continue;
    }
    const content = readFileSync(file);
    hash.update(`${name}:${content.length}\n`);
    hash.update(content);
  }
  return hash.digest("hex");
}

/**
 * Les vrais dossiers de modèle. Un lien, une jonction ou un fichier au nom d'empreinte est laissé en place avec
 * un avertissement : lever ici interromprait le nettoyage des autres modèles, et `copyExistingModel` refuse de
 * toute façon de copier depuis une telle entrée.
 */
function modelDirectories(directory: string, entries: readonly Dirent[]): string[] {
  const directories: string[] = [];
  for (const entry of entries.filter((candidate) => MODEL_HASH.test(candidate.name))) {
    const candidate = path.join(directory, entry.name);
    if (isDirectoryNotLink(candidate)) directories.push(candidate);
    else console.error(`AVERTISSEMENT : ${candidate} n'est pas un dossier de modèle (lien, jonction ou fichier) : laissé en place, sans le suivre.`);
  }
  return directories;
}

function usedTime(model: string): number {
  try {
    return statSync(path.join(model, USED)).mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Supprime les modèles excédentaires, sans jamais suivre un lien ou une jonction. Un modèle utilisé depuis moins
 * de 30 minutes reste, même au-delà de `keep`. Une suppression qui échoue (EBUSY, EPERM) est un avertissement :
 * le ménage ne fait jamais échouer l'appelant.
 */
export function pruneDependencyModels(stateParent: string, keep = 3, remove: (candidate: string) => void = removeModel): void {
  const directory = depsDir(stateParent);
  if (!existsSync(directory)) return;
  const tryRemove = (candidate: string): void => {
    try {
      remove(candidate);
    } catch (error) {
      console.error(`AVERTISSEMENT : ménage des modèles de dépendances, ${candidate} n'a pas pu être supprimé (${describeError(error)}).`);
    }
  };
  const models = readdirSync(directory, { withFileTypes: true });
  // Construction interrompue (processus tué, disque plein) : son dossier temporaire reste. Au-delà d'une
  // heure, aucune construction en cours ne peut encore s'en servir.
  for (const entry of models.filter((candidate) => STALE_TEMPORARY.test(candidate.name))) {
    const candidate = path.join(directory, entry.name);
    if (isDirectoryNotLink(candidate) && Date.now() - statSync(candidate).mtimeMs > STALE_TEMPORARY_MS) tryRemove(candidate);
  }
  modelDirectories(directory, models)
    .sort((left, right) => usedTime(right) - usedTime(left))
    .slice(keep)
    .filter((candidate) => Date.now() - usedTime(candidate) >= RECENTLY_USED_MS)
    .forEach(tryRemove);
}

/** Supprime tous les modèles dont le nom est une empreinte valide, sans suivre les liens. À ne pas lancer en parallèle d'autres tâches. */
export function cleanDependencyModels(stateParent: string): void {
  const directory = depsDir(stateParent);
  if (!existsSync(directory)) return;
  modelDirectories(directory, readdirSync(directory, { withFileTypes: true })).forEach(removeModel);
}

/**
 * Supprime tout `state/deps`, quoi qu'il contienne : après un Codex sans bac à sable ou une ALERTE, aucun modèle
 * n'est plus digne de confiance. Si `state/deps` est un lien ou une jonction, seul le lien est retiré. À ne pas
 * lancer en parallèle d'autres tâches.
 */
export function removeAllDependencyModels(stateParent: string): void {
  const directory = depsDir(stateParent);
  try {
    lstatSync(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  removeEntryWithoutFollowing(directory);
}

/** Supprime d'abord, sans suivre de lien, les entrées dont le nom ne diffère de l'empreinte que par la casse. */
function removeCaseVariants(stateParent: string, hash: string): void {
  const directory = depsDir(stateParent);
  if (!existsSync(directory)) return;
  for (const name of readdirSync(directory)) {
    if (name !== hash && name.toLowerCase() === hash) removeEntryWithoutFollowing(path.join(directory, name));
  }
}

/** Renomme le modèle fini : jusqu'à 3 tentatives, espacées de 500 ms. Un concurrent qui a fini avant nous gagne. */
function publishModel(temporary: string, destination: string, deps: DependencyDeps): void {
  const rename = deps.rename ?? renameSync;
  const sleep = deps.sleep ?? sleepSync;
  for (let attempt = 1; ; attempt += 1) {
    try {
      rename(temporary, destination);
      return;
    } catch (error) {
      if (isComplete(destination)) {
        rmSync(temporary, { recursive: true, force: true, maxRetries: 3 });
        return;
      }
      if (attempt >= RENAME_ATTEMPTS) throw error;
      sleep(RENAME_DELAY_MS);
    }
  }
}

/**
 * Construit une seule fois le modèle correspondant à l'empreinte du dossier demandé. Seul `write.ts` l'appelle
 * (par `copyDependencies`), sur l'extraction du commit de départ et avant le lancement de Codex : aucun autre
 * dossier ne construit de modèle, pour qu'un fichier écrit par Codex n'y entre jamais.
 */
export function ensureDependencyModel(projectDir: string, stateParent: string, deps: DependencyDeps = {}): string {
  const lockfile = path.join(projectDir, "bun.lock");
  const packageJson = path.join(projectDir, "package.json");
  if (!existsSync(lockfile) || !existsSync(packageJson)) throw new UnavailableError(`package.json ou bun.lock est absent de ${projectDir}.`);
  const hash = dependencyHash(projectDir);
  const destination = modelDir(stateParent, hash);
  assertDepsDirNotLink(stateParent);
  // Une entrée au nom en majuscules n'est jamais utilisée (sous Windows, elle masquerait le modèle attendu).
  removeCaseVariants(stateParent, hash);
  if (isComplete(destination)) return destination;

  mkdirSync(depsDir(stateParent), { recursive: true });
  if (existsSync(destination)) {
    if (isComplete(destination)) return destination;
    removeModel(destination);
  }
  const temporary = path.join(depsDir(stateParent), `${hash}.tmp-${process.pid}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(temporary);
  try {
    cpSync(packageJson, path.join(temporary, "package.json"));
    cpSync(lockfile, path.join(temporary, "bun.lock"));
    const bunfig = path.join(projectDir, "bunfig.toml");
    if (existsSync(bunfig)) cpSync(bunfig, path.join(temporary, "bunfig.toml"));
    installDependencies(temporary, deps.install);
    writeFileSync(path.join(temporary, USED), "utilisé\n");
    writeFileSync(path.join(temporary, COMPLETE), "ok\n");
    publishModel(temporary, destination, deps);
  } catch (error) {
    rmSync(temporary, { recursive: true, force: true, maxRetries: 3 });
    if (error instanceof UnavailableError) throw error;
    throw new UnavailableError(`Construction du modèle de dépendances impossible : ${describeError(error)}`);
  }
  try {
    pruneDependencyModels(stateParent);
  } catch (error) {
    console.error(`AVERTISSEMENT : ménage des modèles de dépendances impossible (${describeError(error)}).`);
  }
  return destination;
}

/**
 * Copie dans `projectDir` le modèle complet qui correspond à son empreinte, sans jamais en construire : aucun
 * lien ni jonction vers le cache n'est créé. Rend `false` s'il n'y en a pas (absent, incomplet, lien, ou nom d'une
 * autre casse que l'empreinte en minuscules) : l'appelant installe alors lui-même.
 */
export function copyExistingModel(projectDir: string, stateParent: string, deps: DependencyDeps = {}): boolean {
  if (!existsSync(path.join(projectDir, "package.json")) || !existsSync(path.join(projectDir, "bun.lock"))) return false;
  const hash = dependencyHash(projectDir);
  const directory = depsDir(stateParent);
  assertDepsDirNotLink(stateParent);
  if (!existsSync(directory) || !readdirSync(directory).includes(hash)) return false;
  const model = modelDir(stateParent, hash);
  if (!isComplete(model)) return false;

  const source = path.join(model, "node_modules");
  const destination = path.join(projectDir, "node_modules");
  // Marqué utilisé AVANT la copie : un ménage concurrent ne doit pas le supprimer pendant qu'on le lit.
  const used = path.join(model, USED);
  writeFileSync(used, "utilisé\n");
  const now = new Date();
  utimesSync(used, now, now);
  console.error(`Copie des dépendances dans ${projectDir}…`);
  const started = Date.now();
  if (process.platform === "win32") {
    const result = (deps.robocopy ?? runRobocopy)(source, destination);
    if (result.status === null || result.status >= 8) {
      throw new UnavailableError(`robocopy a échoué (${result.error ?? `code ${result.status}`}) : ${result.output.trimEnd()}`);
    }
  } else {
    try {
      cpSync(source, destination, { recursive: true, verbatimSymlinks: true });
    } catch (error) {
      throw new UnavailableError(`Copie des dépendances impossible : ${describeError(error)}`);
    }
  }
  // Une suppression totale concurrente (ALERTE, sortie du bac à sable, clean --deps) a pu vider le modèle pendant
  // la copie sans que robocopy le signale : la copie serait incomplète.
  if (!isComplete(model)) throw new UnavailableError(`Le modèle de dépendances a été supprimé pendant la copie : ${model}`);
  console.error(`Dépendances copiées en ${Math.round((Date.now() - started) / 1000)} s.`);
  return true;
}

/** Construit le modèle du dossier (s'il manque) puis le copie dedans. Réservé à `write.ts`, avant le lancement de Codex. */
export function copyDependencies(projectDir: string, stateParent: string, deps: DependencyDeps = {}): void {
  ensureDependencyModel(projectDir, stateParent, deps);
  if (!copyExistingModel(projectDir, stateParent, deps)) {
    throw new UnavailableError(`Le modèle de dépendances de ${projectDir} est introuvable après sa construction.`);
  }
}
